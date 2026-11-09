import { addDays } from "@/lib/date";

/** 오답 다시 풀기 간격: 맞힐 때마다 1 → 3 → 7 → 14일, 3번 연속 맞히면 정복 */
export const RETRY_INTERVALS = [1, 3, 7, 14];
export const MASTER_STREAK = 3;

export function nextRetryAfter(
  current: { streak: number },
  correct: boolean,
  today: string,
): { streak: number; mastered: boolean; nextRetry: string } {
  if (!correct) return { streak: 0, mastered: false, nextRetry: addDays(today, 1) };
  const streak = current.streak + 1;
  const interval = RETRY_INTERVALS[Math.min(streak, RETRY_INTERVALS.length - 1)];
  return { streak, mastered: streak >= MASTER_STREAK, nextRetry: addDays(today, interval) };
}

/** 단원을 공부한 뒤 복습할 날 (에빙하우스 망각곡선 기반) */
export const SPACED_STEPS = [1, 3, 7, 14];
