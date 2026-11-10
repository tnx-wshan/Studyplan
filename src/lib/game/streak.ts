import { addDays, daysBetween, toDateKey } from "@/lib/date";

export interface StreakInfo {
  current: number;
  longest: number;
  studiedToday: boolean;
}

export const MAX_FREEZES = 2;

/**
 * 공부한 날짜 목록으로 연속 학습일을 계산한다.
 * - 오늘 아직 공부하지 않았어도 어제까지 이어졌다면 연속 기록은 유지된다.
 * - 보호권을 쓴 날(frozen)은 기록을 이어 주지만 연속 일수에는 세지 않는다.
 */
export function computeStreak(dateKeys: Iterable<string>, today: string = toDateKey(), frozen: Iterable<string> = []): StreakInfo {
  const days = new Set(dateKeys);
  const bridge = new Set(frozen);
  const all = [...new Set([...days, ...bridge])].sort();

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of all) {
    if (prev === null || daysBetween(prev, d) !== 1) run = 0;
    if (days.has(d)) run += 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  const studiedToday = days.has(today);
  let cursor = studiedToday ? today : addDays(today, -1);
  let current = 0;
  while (days.has(cursor) || bridge.has(cursor)) {
    if (days.has(cursor)) current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, longest, studiedToday };
}

/**
 * 보호권으로 메울 날짜를 정한다.
 * 마지막으로 공부한 날과 오늘 사이에 빠진 날이 있고, 보호권이 그 수만큼 있으면 그 날짜들을 돌려준다.
 * 빠진 날이 보호권보다 많으면 지킬 수 없으므로 쓰지 않는다(빈 배열).
 */
export function daysToFreeze(dateKeys: Iterable<string>, frozen: Iterable<string>, freezes: number, today: string = toDateKey()): string[] {
  const covered = new Set([...dateKeys, ...frozen]);
  const studied = [...new Set(dateKeys)].filter((d) => d < today).sort();
  const last = studied.at(-1);
  if (!last || freezes <= 0) return [];
  const missing: string[] = [];
  for (let d = addDays(last, 1); d < today; d = addDays(d, 1)) if (!covered.has(d)) missing.push(d);
  return missing.length > 0 && missing.length <= freezes ? missing : [];
}
