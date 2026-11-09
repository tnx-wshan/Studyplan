import { addDays, daysBetween, toDateKey } from "@/lib/date";
import type { MethodLog, Question, Quiz, StudySession, Task, WrongAnswer, XpEvent } from "@/lib/db/types";
import { inPeriod, type Period } from "./period";

export interface ReportInput {
  sessions: StudySession[];
  tasks: Task[];
  xpEvents: XpEvent[];
  wrongAnswers: WrongAnswer[];
  quizzes: Quiz[];
  questions: Pick<Question, "quizId" | "result" | "updatedAt">[];
  methodLogs: MethodLog[];
}

export interface ReportStats {
  totalMinutes: number;
  studyDays: number;
  days: number;
  byDay: { date: string; minutes: number }[];
  bySubject: { subjectId: string; minutes: number }[];
  tasksPlanned: number;
  tasksDone: number;
  cardsReviewed: number;
  wrongAdded: number;
  wrongRetried: number;
  wrongMastered: number;
  wrongByReason: Record<WrongAnswer["reason"], number>;
  quizCorrect: number;
  quizTotal: number;
  methodPractices: { methodId: string; count: number }[];
  xp: number;
}

const dayOf = (ts: number) => toDateKey(new Date(ts));

/** 기간 하나의 공부 통계. 순수 함수라 주간·월간 리포트와 AI 코칭이 같이 쓴다. */
export function computeReport(input: ReportInput, period: Pick<Period, "start" | "end">): ReportStats {
  const inP = (d: string) => inPeriod(d, period);
  const days = daysBetween(period.start, period.end);
  const byDay = new Map<string, number>();
  for (let i = 0; i < days; i++) byDay.set(addDays(period.start, i), 0);
  const bySubject = new Map<string, number>();
  let totalMinutes = 0;
  for (const s of input.sessions) {
    if (!inP(s.date)) continue;
    totalMinutes += s.focusMinutes;
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.focusMinutes);
    const key = s.subjectId ?? "none";
    bySubject.set(key, (bySubject.get(key) ?? 0) + s.focusMinutes);
  }

  const events = input.xpEvents.filter((e) => inP(e.date));
  const activeDays = new Set([...input.sessions.filter((s) => inP(s.date)).map((s) => s.date), ...events.map((e) => e.date)]);

  const tasks = input.tasks.filter((t) => inP(t.date));
  const wrongAdded = input.wrongAnswers.filter((w) => inP(dayOf(w.createdAt)));
  const wrongByReason = { concept: 0, mistake: 0, time: 0, other: 0 };
  for (const w of wrongAdded) wrongByReason[w.reason] += 1;
  const wrongMastered = input.wrongAnswers.filter((w) => {
    const last = w.retries.at(-1);
    return w.mastered && last && inP(dayOf(last.at));
  }).length;

  let quizCorrect = 0;
  let quizTotal = 0;
  for (const q of input.quizzes) {
    for (const a of q.attempts) {
      if (!inP(dayOf(a.at))) continue;
      quizCorrect += a.score;
      quizTotal += a.total;
    }
  }

  const methodCounts = new Map<string, number>();
  for (const m of input.methodLogs) if (inP(m.date)) methodCounts.set(m.methodId, (methodCounts.get(m.methodId) ?? 0) + 1);

  return {
    totalMinutes,
    studyDays: activeDays.size,
    days,
    byDay: [...byDay.entries()].map(([date, minutes]) => ({ date, minutes })),
    bySubject: [...bySubject.entries()].map(([subjectId, minutes]) => ({ subjectId, minutes })).sort((a, b) => b.minutes - a.minutes),
    tasksPlanned: tasks.length,
    tasksDone: tasks.filter((t) => t.done).length,
    cardsReviewed: events.filter((e) => e.reason === "card").length,
    wrongAdded: wrongAdded.length,
    wrongRetried: events.filter((e) => e.reason === "wrong").length,
    wrongMastered,
    wrongByReason,
    quizCorrect,
    quizTotal,
    methodPractices: [...methodCounts.entries()].map(([methodId, count]) => ({ methodId, count })).sort((a, b) => b.count - a.count),
    xp: events.reduce((s, e) => s + e.amount, 0),
  };
}

/** 지난 기간 대비 변화 (+12, -5 …). 지난 기간이 0이면 null */
export function change(now: number, before: number): number | null {
  if (before === 0) return null;
  return Math.round(((now - before) / before) * 100);
}
