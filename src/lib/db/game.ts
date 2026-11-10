import { getDB, newId } from "./index";
import { addXpInTx } from "./profile";
import type { Profile } from "./types";
import { shopItem } from "@/data/shop";
import { toDateKey } from "@/lib/date";
import { BADGES, EXAM_MILESTONES, WEEKLY_QUESTS, earnedBadges, examProgress, examQuestId, type Totals } from "@/lib/game/achievements";
import { levelFromXp } from "@/lib/game/level";
import { computeStreak } from "@/lib/game/streak";
import { weekKey, weekPeriod } from "@/lib/study/period";
import { computeReport } from "@/lib/study/report";
import { loadReportInput } from "./coaching";

const now = () => Date.now();

async function claim(id: string, questId: string, period: string, reward: number, at: number) {
  const db = getDB();
  return db.transaction("rw", db.userQuests, db.profile, db.xpEvents, async () => {
    if (await db.userQuests.get(id)) return false;
    await db.userQuests.add({ id, questId, period, progress: 1, completedAt: at, createdAt: at, updatedAt: at });
    await addXpInTx(db, reward, `quest:${questId}`, at);
    return true;
  });
}

/** 이번 주 퀘스트 진행 상황 */
export async function weeklyStatus(today = toDateKey()) {
  const week = weekKey(today);
  const input = await loadReportInput();
  const stats = computeReport(input, weekPeriod(week));
  const reflectionWritten = !!(await getDB().reflections.get(week));
  const claimed = new Set((await getDB().userQuests.where("period").equals(week).toArray()).map((q) => q.questId));
  return {
    week,
    quests: WEEKLY_QUESTS.map((q) => {
      const value = q.value({ stats, reflectionWritten });
      return { quest: q, value: Math.min(value, q.target), done: value >= q.target, claimed: claimed.has(q.id) };
    }),
  };
}

export async function claimWeeklyQuest(questId: string, today = toDateKey(), at = now()) {
  const status = await weeklyStatus(today);
  const q = status.quests.find((x) => x.quest.id === questId);
  if (!q || !q.done) return false;
  return claim(`${questId}:${status.week}`, questId, status.week, q.quest.reward, at);
}

/** 다가오는(또는 오늘) 시험들의 단계별 퀘스트 */
export async function examQuestStatus(today = toDateKey()) {
  const db = getDB();
  const exams = await db.exams.where("date").aboveOrEqual(today).sortBy("date");
  const tasks = await db.tasks.filter((t) => !!t.examId).toArray();
  const claimed = new Set((await db.userQuests.toArray()).filter((q) => q.id.startsWith("exam:")).map((q) => q.id));
  return exams.map((exam) => {
    const p = examProgress(exam, tasks);
    return {
      exam,
      progress: p,
      milestones: EXAM_MILESTONES.map((m) => ({ ...m, id: examQuestId(exam.id, m.pct), reached: p.total > 0 && p.pct >= m.pct, claimed: claimed.has(examQuestId(exam.id, m.pct)) })),
    };
  });
}

export async function claimExamMilestone(examId: string, pct: number, today = toDateKey(), at = now()) {
  const status = (await examQuestStatus(today)).find((s) => s.exam.id === examId);
  const m = status?.milestones.find((x) => x.pct === pct);
  if (!status || !m || !m.reached) return false;
  return claim(m.id, `exam${pct}`, status.exam.id, m.reward, at);
}

// ───────── 업적 ─────────

export async function computeTotals(): Promise<Totals> {
  const db = getDB();
  const input = await loadReportInput();
  const [profile, reflections] = await Promise.all([db.profile.get("me"), db.reflections.count()]);
  const days = new Set([...input.sessions.map((s) => s.date), ...input.xpEvents.map((e) => e.date)]);
  return {
    longestStreak: computeStreak(days).longest,
    totalMinutes: input.sessions.reduce((s, x) => s + x.focusMinutes, 0),
    cardsReviewed: input.xpEvents.filter((e) => e.reason === "card").length,
    wrongMastered: input.wrongAnswers.filter((w) => w.mastered).length,
    quizzesFinished: input.quizzes.reduce((s, q) => s + q.attempts.length, 0),
    methodsTried: new Set(input.methodLogs.map((m) => m.methodId)).size,
    reflections,
    level: levelFromXp(profile?.totalXp ?? 0).level,
    tasksDone: input.tasks.filter((t) => t.done).length,
  };
}

/** 새로 달성한 업적을 기록하고 그 id들을 돌려준다 */
export async function syncBadges(at = now()): Promise<string[]> {
  const db = getDB();
  const earned = earnedBadges(await computeTotals());
  return db.transaction("rw", db.userBadges, async () => {
    const have = new Set((await db.userBadges.toArray()).map((b) => b.badgeId));
    const fresh = earned.filter((id) => !have.has(id));
    await db.userBadges.bulkAdd(fresh.map((badgeId) => ({ id: newId(), badgeId, createdAt: at, updatedAt: at })));
    return fresh;
  });
}

export async function setTitleBadge(badgeId?: string) {
  if (badgeId && !BADGES.some((b) => b.id === badgeId)) return;
  await getDB().profile.update("me", { titleBadge: badgeId, updatedAt: now() });
}

// ───────── 상점 ─────────

export type BuyResult = "ok" | "owned" | "coins" | "unknown";

export async function buyItem(itemId: string): Promise<BuyResult> {
  const item = shopItem(itemId);
  if (!item) return "unknown";
  const db = getDB();
  return db.transaction("rw", db.profile, async () => {
    const p = await db.profile.get("me");
    if (!p) return "unknown";
    if (p.owned?.includes(itemId)) return "owned";
    if (p.coins < item.price) return "coins";
    await db.profile.update("me", {
      coins: p.coins - item.price,
      owned: [...(p.owned ?? []), itemId],
      equipped: { ...p.equipped, [item.kind]: itemId },
      updatedAt: now(),
    });
    return "ok";
  });
}

export async function equipItem(kind: "accessory" | "background", itemId?: string) {
  const db = getDB();
  const p = (await db.profile.get("me")) as Profile | undefined;
  if (!p) return;
  if (itemId && !p.owned?.includes(itemId)) return;
  await db.profile.update("me", { equipped: { ...p.equipped, [kind]: itemId }, updatedAt: now() });
}

export async function setStyle(style: NonNullable<Profile["style"]>) {
  await getDB().profile.update("me", { style, updatedAt: now() });
}
