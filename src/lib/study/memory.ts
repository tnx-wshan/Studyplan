import { addDays, toDateKey } from "@/lib/date";
import type { Card, Task, WrongAnswer } from "@/lib/db/types";

/**
 * 기억 지도: 단원마다 '지금 얼마나 기억에 남아 있을지'를 추정한다.
 *
 * 망각 곡선 R = e^(-t/S)을 쓴다. t는 마지막으로 공부한 뒤 지난 날, S(안정도)는 복습할수록 길어진다.
 * 처음 공부하면 S=2일, 복습할 때마다 두 배(4, 8, 16…, 최대 60일).
 * 실제 기억을 재는 것이 아니라 공부 기록으로 어림한 값이므로, 화면에도 '추정'이라고 표시한다.
 */
export type MemoryStatus = "fresh" | "fading" | "risk";

export interface UnitMemory {
  subjectId: string;
  unit: string;
  /** 공부·복습한 횟수 */
  reviews: number;
  lastAt: number;
  daysSince: number;
  stability: number;
  /** 추정 기억률 0~100 */
  retention: number;
  status: MemoryStatus;
  /** 아직 정복하지 못한 오답 수 */
  openWrong: number;
}

const DAY = 86_400_000;
export const memoryKey = (subjectId: string, unit: string) => `${subjectId}::${unit}`;

export function stabilityFor(reviews: number): number {
  return Math.min(60, 2 * 2 ** Math.max(0, reviews - 1));
}

export function retentionAt(days: number, stability: number): number {
  return Math.round(100 * Math.exp(-Math.max(0, days) / stability));
}

export function statusFor(retention: number): MemoryStatus {
  return retention >= 75 ? "fresh" : retention >= 45 ? "fading" : "risk";
}

export function computeMemory(tasks: Task[], wrongAnswers: WrongAnswer[], now = Date.now()): Map<string, UnitMemory> {
  const events = new Map<string, number[]>();
  const push = (subjectId: string | undefined, unit: string | undefined, at: number | undefined) => {
    if (!subjectId || !unit || !at) return;
    const key = memoryKey(subjectId, unit);
    events.set(key, [...(events.get(key) ?? []), at]);
  };
  for (const t of tasks) if (t.done) push(t.subjectId, t.unit, t.doneAt);
  // 오답을 다시 풀어 맞힌 것도 그 단원의 복습으로 친다
  for (const w of wrongAnswers) for (const r of w.retries) if (r.correct) push(w.subjectId, w.unitId, r.at);

  const openWrong = new Map<string, number>();
  for (const w of wrongAnswers) {
    if (w.mastered || !w.subjectId || !w.unitId) continue;
    const key = memoryKey(w.subjectId, w.unitId);
    openWrong.set(key, (openWrong.get(key) ?? 0) + 1);
  }

  const out = new Map<string, UnitMemory>();
  for (const [key, times] of events) {
    const [subjectId, unit] = key.split("::");
    const lastAt = Math.max(...times);
    const days = (now - lastAt) / DAY;
    const stability = stabilityFor(times.length);
    const retention = retentionAt(days, stability);
    out.set(key, { subjectId, unit, reviews: times.length, lastAt, daysSince: Math.max(0, Math.floor(days)), stability, retention, status: statusFor(retention), openWrong: openWrong.get(key) ?? 0 });
  }
  return out;
}

export interface ForecastDay {
  date: string;
  cards: number;
  wrong: number;
  spaced: number;
  total: number;
}

/** 오늘부터 며칠 동안 복습할 양. 오늘 칸에는 밀린 것도 포함한다. */
export function reviewForecast(cards: Pick<Card, "due">[], wrongAnswers: Pick<WrongAnswer, "nextRetry" | "mastered">[], tasks: Pick<Task, "date" | "kind" | "done">[], today = toDateKey(), days = 7): ForecastDay[] {
  const out: ForecastDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const inDay = (d: string) => (i === 0 ? d <= date : d === date);
    const c = cards.filter((x) => inDay(toDateKey(new Date(x.due)))).length;
    const w = wrongAnswers.filter((x) => !x.mastered && inDay(x.nextRetry)).length;
    const s = tasks.filter((x) => x.kind === "spaced" && !x.done && inDay(x.date)).length;
    out.push({ date, cards: c, wrong: w, spaced: s, total: c + w + s });
  }
  return out;
}
