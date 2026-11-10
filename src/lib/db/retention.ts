import { getDB } from "./index";
import { addXpInTx } from "./profile";
import { dailyStats, replanExam } from "./study";
import { addDays, daysBetween, toDateKey } from "@/lib/date";
import { MAX_FREEZES, daysToFreeze } from "@/lib/game/streak";
import { weekKey, weekPeriod } from "@/lib/study/period";

const now = () => Date.now();

async function studyDays(): Promise<string[]> {
  const db = getDB();
  const [a, b] = await Promise.all([db.studySessions.orderBy("date").uniqueKeys(), db.xpEvents.orderBy("date").uniqueKeys()]);
  return [...new Set([...(a as string[]), ...(b as string[])])].sort();
}

// ───────── 1. 연속 기록 보호권 ─────────

/** 보호권을 받기 위해 한 주에 끝내야 하는 주간 퀘스트 수 */
export const FREEZE_QUESTS_NEEDED = 3;

/**
 * 앱을 열 때 호출: 어제까지 빠진 날을 보호권으로 메울 수 있으면 자동으로 쓴다.
 * 쓴 날짜들을 돌려준다.
 */
export async function applyStreakFreeze(today = toDateKey()): Promise<string[]> {
  const db = getDB();
  const days = await studyDays();
  return db.transaction("rw", db.profile, async () => {
    const p = await db.profile.get("me");
    if (!p) return [];
    const use = daysToFreeze(days, p.frozenDays ?? [], p.freezes ?? 0, today);
    if (use.length === 0) return [];
    await db.profile.update("me", { freezes: (p.freezes ?? 0) - use.length, frozenDays: [...(p.frozenDays ?? []), ...use], updatedAt: now() });
    return use;
  });
}

/** 주간 퀘스트를 3개 완수하면 그 주에 한 번 보호권을 준다 (최대 2개 보관). 받았으면 true */
export async function maybeAwardFreeze(week: string, at = now()): Promise<boolean> {
  const db = getDB();
  const id = `freeze:${week}`;
  return db.transaction("rw", db.userQuests, db.profile, async () => {
    if (await db.userQuests.get(id)) return false;
    const claimed = (await db.userQuests.where("period").equals(week).toArray()).filter((q) => q.questId.startsWith("w")).length;
    const p = await db.profile.get("me");
    if (!p || claimed < FREEZE_QUESTS_NEEDED || (p.freezes ?? 0) >= MAX_FREEZES) return false;
    await db.userQuests.add({ id, questId: "freeze", period: `freeze:${week}`, progress: 1, completedAt: at, createdAt: at, updatedAt: at });
    await db.profile.update("me", { freezes: (p.freezes ?? 0) + 1, updatedAt: at });
    return true;
  });
}

// ───────── 3. 복귀 환영 ─────────

export const COMEBACK_AFTER_DAYS = 3;

export const COMEBACK_QUESTS = [
  { id: "c-focus", icon: "⏱️", title: "5분만 집중하기", noirTitle: "5분의 재개", target: 5, reward: 30, href: "/timer" },
  { id: "c-review", icon: "🃏", title: "카드 5장 넘기거나 오답 1개 풀기", noirTitle: "기억 한 조각 되찾기", target: 1, reward: 30, href: "/review" },
  { id: "c-task", icon: "✅", title: "오늘 할 일 1개 끝내기", noirTitle: "의뢰 하나 완수", target: 1, reward: 30, href: "/planner" },
] as const;

/**
 * 앱을 열 때 호출: 3일 넘게 쉬었다 돌아온 날이면 복귀 상태를 기록한다.
 * (그날 공부를 시작해도 하루 동안 복귀 환영이 유지된다)
 */
export async function detectComeback(today = toDateKey()): Promise<boolean> {
  const db = getDB();
  const days = (await studyDays()).filter((d) => d < today);
  const last = days.at(-1);
  if (!last) return false;
  const away = daysBetween(last, today) - 1;
  if (away < COMEBACK_AFTER_DAYS) return false;
  const p = await db.profile.get("me");
  if (!p || p.comeback?.date === today) return false;
  await db.profile.update("me", { comeback: { date: today, awayDays: away }, updatedAt: now() });
  return true;
}

export async function comebackStatus(today = toDateKey()) {
  const db = getDB();
  const p = await db.profile.get("me");
  if (p?.comeback?.date !== today) return null;
  const stats = await dailyStats(today);
  const claimed = new Set((await db.userQuests.where("period").equals(`comeback:${today}`).toArray()).map((q) => q.questId));
  const values: Record<string, number> = {
    "c-focus": stats.focusMinutes,
    "c-review": stats.cardsReviewed >= 5 || stats.wrongRetried >= 1 ? 1 : 0,
    "c-task": stats.tasksDone,
  };
  const backlog = await db.tasks.where("date").below(today).filter((t) => !t.done).count();
  return {
    awayDays: p.comeback.awayDays,
    backlog,
    quests: COMEBACK_QUESTS.map((q) => ({ quest: q, value: Math.min(values[q.id], q.target), done: values[q.id] >= q.target, claimed: claimed.has(q.id) })),
  };
}

export async function claimComebackQuest(questId: string, today = toDateKey(), at = now()): Promise<boolean> {
  const status = await comebackStatus(today);
  const q = status?.quests.find((x) => x.quest.id === questId);
  if (!q || !q.done || q.claimed) return false;
  const db = getDB();
  const id = `comeback:${today}:${questId}`;
  return db.transaction("rw", db.userQuests, db.profile, db.xpEvents, async () => {
    if (await db.userQuests.get(id)) return false;
    await db.userQuests.add({ id, questId, period: `comeback:${today}`, progress: 1, completedAt: at, createdAt: at, updatedAt: at });
    await addXpInTx(db, q.quest.reward, `quest:${questId}`, at);
    return true;
  });
}

/**
 * 밀린 계획 정리:
 * - 지난 간격 복습 할 일은 지운다 (복습 카드·오답노트가 대신 챙겨 준다)
 * - 다가오는 시험의 밀린 계획은 남은 날에 맞춰 다시 짠다
 * - 직접 만든 할 일은 건드리지 않는다
 */
export async function tidyBacklog(today = toDateKey()) {
  const db = getDB();
  const overdue = await db.tasks.where("date").below(today).filter((t) => !t.done).toArray();
  const spaced = overdue.filter((t) => t.kind === "spaced");
  await db.tasks.bulkDelete(spaced.map((t) => t.id));
  const examIds = [...new Set(overdue.filter((t) => t.examId && t.kind !== "spaced").map((t) => t.examId!))];
  let replanned = 0;
  for (const id of examIds) {
    const exam = await db.exams.get(id);
    if (exam && exam.date > today) {
      await replanExam(id, today);
      replanned++;
    }
  }
  const left = await db.tasks.where("date").below(today).filter((t) => !t.done).count();
  return { removedReviews: spaced.length, replannedExams: replanned, left };
}

// ───────── 4. 주간 목표 약속 ─────────

export const GOAL_REWARD = 50;
export const GOAL_CHOICES = [120, 180, 300, 420, 600];

export async function weekFocusMinutes(week: string): Promise<number> {
  const p = weekPeriod(week);
  const sessions = await getDB().studySessions.where("date").between(p.start, p.end, true, false).toArray();
  return sessions.reduce((s, x) => s + x.focusMinutes, 0);
}

/** 지난주 실제 기록보다 10% 많게(30분 단위), 기록이 없으면 180분 */
export function suggestGoal(lastWeekMinutes: number): number {
  if (lastWeekMinutes < 60) return 180;
  return Math.min(1200, Math.max(120, Math.ceil((lastWeekMinutes * 1.1) / 30) * 30));
}

export async function weeklyGoalStatus(today = toDateKey()) {
  const db = getDB();
  const week = weekKey(today);
  const period = weekPeriod(week);
  const p = await db.profile.get("me");
  const goal = p?.weeklyGoals?.[week] ?? null;
  const minutes = await weekFocusMinutes(week);
  const lastWeek = await weekFocusMinutes(weekKey(addDays(period.start, -7)));
  const daysLeft = daysBetween(today, period.end); // 오늘 포함 남은 날
  const remaining = goal ? Math.max(0, goal - minutes) : 0;
  return {
    week,
    goal,
    minutes,
    lastWeek,
    suggestion: suggestGoal(lastWeek),
    daysLeft,
    perDay: goal && remaining > 0 ? Math.ceil(remaining / Math.max(1, daysLeft)) : 0,
    achieved: !!goal && minutes >= goal,
    claimed: !!(await db.userQuests.get(`goal:${week}`)),
  };
}

export async function setWeeklyGoal(minutes: number, today = toDateKey()) {
  const db = getDB();
  const week = weekKey(today);
  const p = await db.profile.get("me");
  if (!p) return;
  await db.profile.update("me", { weeklyGoals: { ...p.weeklyGoals, [week]: Math.round(minutes) }, updatedAt: now() });
}

export async function claimWeeklyGoal(today = toDateKey(), at = now()): Promise<boolean> {
  const s = await weeklyGoalStatus(today);
  if (!s.achieved || s.claimed) return false;
  const db = getDB();
  const id = `goal:${s.week}`;
  return db.transaction("rw", db.userQuests, db.profile, db.xpEvents, async () => {
    if (await db.userQuests.get(id)) return false;
    await db.userQuests.add({ id, questId: "goal", period: `goal:${s.week}`, progress: 1, completedAt: at, createdAt: at, updatedAt: at });
    await addXpInTx(db, GOAL_REWARD, "quest:goal", at);
    return true;
  });
}
