import { getDB, newId } from "./index";
import { addXpInTx } from "./profile";
import type { LearnLog, LearnProgress } from "./types";
import { addDays, toDateKey } from "@/lib/date";
import { lessonXp, type LessonScore } from "@/lib/learn/engine";
import { DEFAULT_LEARN_GOAL } from "@/lib/learn/types";
import { weekKey, weekPeriod } from "@/lib/study/period";

/** 학습 탭 진도와 기록 (기기 안) */

export interface FinishInput {
  unitId: string;
  courseKey: string;
  title: string;
  score: LessonScore;
  seconds: number;
}

/** 유닛을 끝냈다: 진도·기록을 남기고 경험치를 준다. 받은 경험치와 처음 끝냈는지 돌려준다 */
export async function finishUnit(input: FinishInput, at = Date.now()) {
  const db = getDB();
  return db.transaction("rw", db.learnProgress, db.learnLogs, db.profile, db.xpEvents, async () => {
    const prev = await db.learnProgress.get(input.unitId);
    const first = !prev;
    const xp = lessonXp(input.score, first);
    const progress: LearnProgress = {
      id: input.unitId,
      courseKey: input.courseKey,
      title: input.title,
      completedAt: prev?.completedAt ?? at,
      bestCorrect: Math.max(prev?.bestCorrect ?? 0, input.score.correct),
      total: input.score.total,
      attempts: (prev?.attempts ?? 0) + 1,
      createdAt: prev?.createdAt ?? at,
      updatedAt: at,
    };
    await db.learnProgress.put(progress);
    const log: LearnLog = { id: newId(), date: toDateKey(new Date(at)), at, unitId: input.unitId, courseKey: input.courseKey, seconds: input.seconds, correct: input.score.correct, total: input.score.total, xp };
    await db.learnLogs.add(log);
    await addXpInTx(db, xp, "learn", at);
    return { xp, first };
  });
}

/** 날짜별 학습 시간(초) */
export async function learnSecondsOn(date: string): Promise<number> {
  const logs = await getDB().learnLogs.where("date").equals(date).toArray();
  return logs.reduce((s, l) => s + l.seconds, 0);
}

export async function learnSecondsBetween(from: string, to: string): Promise<number> {
  const logs = await getDB().learnLogs.where("date").between(from, to, true, true).toArray();
  return logs.reduce((s, l) => s + l.seconds, 0);
}

export interface DailyLearn {
  goalMinutes: number;
  todaySeconds: number;
  todayUnits: number;
  /** 목표를 채운 날이 오늘까지 며칠 이어졌는지 */
  goalStreak: number;
  /** 이번 주 7일의 학습 시간(초), 월요일부터 */
  week: { date: string; seconds: number }[];
}

export async function dailyLearn(today = toDateKey()): Promise<DailyLearn> {
  const db = getDB();
  const profile = await db.profile.get("me");
  const goalMinutes = profile?.learnGoal ?? DEFAULT_LEARN_GOAL;
  const from = addDays(today, -60);
  const logs = await db.learnLogs.where("date").between(from, today, true, true).toArray();
  const byDate = new Map<string, number>();
  for (const l of logs) byDate.set(l.date, (byDate.get(l.date) ?? 0) + l.seconds);
  const met = (d: string) => (byDate.get(d) ?? 0) >= goalMinutes * 60;
  // 오늘 아직 못 채웠으면 어제까지의 연속 기록을 보여준다
  let day = met(today) ? today : addDays(today, -1);
  let goalStreak = 0;
  while (met(day)) {
    goalStreak++;
    day = addDays(day, -1);
  }
  const period = weekPeriod(weekKey(today));
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(period.start, i);
    return { date, seconds: byDate.get(date) ?? 0 };
  });
  return {
    goalMinutes,
    todaySeconds: byDate.get(today) ?? 0,
    todayUnits: logs.filter((l) => l.date === today).length,
    goalStreak,
    week,
  };
}

export async function doneUnitIds(courseKey?: string): Promise<Set<string>> {
  const db = getDB();
  const rows = courseKey ? await db.learnProgress.where("courseKey").equals(courseKey).toArray() : await db.learnProgress.toArray();
  return new Set(rows.map((r) => r.id));
}
