import { addDays, daysBetween, toDateKey } from "@/lib/date";

export interface StreakInfo {
  current: number;
  longest: number;
  studiedToday: boolean;
}

/**
 * 공부한 날짜 목록으로 연속 학습일을 계산한다.
 * 오늘 아직 공부하지 않았어도 어제까지 이어졌다면 연속 기록은 유지된다.
 */
export function computeStreak(dateKeys: Iterable<string>, today: string = toDateKey()): StreakInfo {
  const days = new Set(dateKeys);
  const sorted = [...days].sort();

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev !== null && daysBetween(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  const studiedToday = days.has(today);
  let cursor = studiedToday ? today : addDays(today, -1);
  let current = 0;
  while (days.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, longest, studiedToday };
}
