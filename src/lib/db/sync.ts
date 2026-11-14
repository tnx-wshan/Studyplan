import { getDB, newId } from "./index";
import { signOutDevice } from "./account";
import { computeStreak } from "@/lib/game/streak";
import { levelFromXp } from "@/lib/game/level";
import { toDateKey } from "@/lib/date";
import { courseKey } from "@/lib/learn/types";
import { weekKey, weekPeriod } from "@/lib/study/period";
import { learnSecondsBetween, learnSecondsOn } from "./learn";
import type { StoredCommand, SyncRequest, SyncResponse, UserSnapshot } from "@/lib/sync/types";

/**
 * 관리 도구와의 동기화.
 * 기기 → 서버: 레벨·경험치·연속 기록·학습 진도 요약
 * 서버 → 기기: 이용 상태(정지 여부)와 관리자가 고친 값(명령)
 */

/** 서버가 이 기기를 알아볼 id. 없으면 만든다 */
export async function ensureServerId(): Promise<string | null> {
  const db = getDB();
  const p = await db.profile.get("me");
  if (!p) return null;
  if (p.serverId) return p.serverId;
  const id = newId();
  await db.profile.update("me", { serverId: id });
  return id;
}

export async function buildSnapshot(today = toDateKey()): Promise<UserSnapshot | null> {
  const db = getDB();
  const p = await db.profile.get("me");
  if (!p) return null;
  const [sessionDays, xpDays, done] = await Promise.all([db.studySessions.orderBy("date").uniqueKeys(), db.xpEvents.orderBy("date").uniqueKeys(), db.learnProgress.toArray()]);
  const days = new Set([...(sessionDays as string[]), ...(xpDays as string[])]);
  const streak = computeStreak(days, today, p.frozenDays);
  const period = weekPeriod(weekKey(today));
  return {
    level: levelFromXp(p.totalXp).level,
    totalXp: Math.max(0, Math.round(p.totalXp)),
    coins: Math.max(0, Math.round(p.coins)),
    freezes: Math.min(10, p.freezes ?? 0),
    streak: streak.current,
    longestStreak: streak.longest,
    learnDone: done.map((d) => d.id),
    learnTodaySec: await learnSecondsOn(today),
    learnWeekSec: await learnSecondsBetween(period.start, today),
    learnCourse: p.learnCourse ? courseKey(p.learnCourse.grade, p.learnCourse.subject) : undefined,
    lastStudyDate: [...days].sort().at(-1),
  };
}

/** 관리자가 내린 명령을 기기 데이터에 적용한다. 이미 적용한 번호는 건너뛴다. 마지막 번호를 돌려준다 */
export async function applyCommands(commands: StoredCommand[], at = Date.now()): Promise<number> {
  const db = getDB();
  return db.transaction("rw", db.profile, db.learnProgress, async () => {
    const p = await db.profile.get("me");
    if (!p) return 0;
    let last = p.lastCommandId ?? 0;
    for (const c of [...commands].sort((a, b) => a.id - b.id)) {
      if (c.id <= last) continue;
      const payload = c.payload as Record<string, unknown>;
      switch (c.type) {
        case "setXp":
          await db.profile.update("me", { totalXp: Number(payload.totalXp) || 0, updatedAt: at });
          break;
        case "setCoins":
          await db.profile.update("me", { coins: Number(payload.coins) || 0, updatedAt: at });
          break;
        case "setFreezes":
          await db.profile.update("me", { freezes: Math.max(0, Math.min(2, Number(payload.freezes) || 0)), updatedAt: at });
          break;
        case "setNickname":
          if (typeof payload.nickname === "string" && payload.nickname.trim()) await db.profile.update("me", { nickname: payload.nickname.trim(), updatedAt: at });
          break;
        case "learnComplete": {
          const id = String(payload.unitId);
          if (!(await db.learnProgress.get(id))) {
            await db.learnProgress.put({ id, courseKey: String(payload.courseKey), title: "", completedAt: at, bestCorrect: 0, total: 0, attempts: 0, byAdmin: true, createdAt: at, updatedAt: at });
          }
          break;
        }
        case "learnReset":
          await db.learnProgress.delete(String(payload.unitId));
          break;
        case "learnResetCourse":
          await db.learnProgress.where("courseKey").equals(String(payload.courseKey)).delete();
          break;
      }
      last = c.id;
    }
    await db.profile.update("me", { lastCommandId: last });
    return last;
  });
}

async function post(body: SyncRequest): Promise<SyncResponse | null> {
  try {
    const res = await fetch("/api/user/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    if (res.status === 401) {
      // 로그인이 풀렸다 (다른 기기에서 비밀번호를 바꿨거나 계정이 없어졌다): 다시 로그인하게 한다
      signOutDevice();
      if (typeof window !== "undefined") window.location.replace("/login");
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as SyncResponse;
  } catch {
    return null; // 오프라인이면 다음에
  }
}

async function request(): Promise<SyncRequest | null> {
  const db = getDB();
  const [userId, snapshot, p] = await Promise.all([ensureServerId(), buildSnapshot(), db.profile.get("me")]);
  if (!userId || !snapshot || !p) return null;
  return { userId, nickname: p.nickname, grade: p.grade, snapshot, lastCommandId: p.lastCommandId ?? 0 };
}

/**
 * 한 번 동기화한다. 명령을 받으면 적용한 뒤 바뀐 요약을 다시 보낸다 (서버가 적용됨으로 표시하도록).
 * 오프라인이거나 서버가 응답하지 않으면 null.
 */
export async function syncNow(): Promise<SyncResponse | null> {
  const body = await request();
  if (!body) return null;
  const res = await post(body);
  if (!res) return null;
  // 서버는 로그인한 계정의 id로 이 기기를 알아본다
  if (res.userId && res.userId !== body.userId) await getDB().profile.update("me", { serverId: res.userId });
  if (res.commands.length > 0) {
    await applyCommands(res.commands);
    const again = await request();
    if (again) return (await post(again)) ?? res;
  }
  return res;
}
