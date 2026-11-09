import type { SrsState } from "@/lib/db/types";

/** 1=다시, 2=어려움, 3=알맞음, 4=쉬움 */
export type Rating = 1 | 2 | 3 | 4;

export const RATING_LABELS: Record<Rating, string> = { 1: "다시", 2: "어려움", 3: "알맞음", 4: "쉬움" };

const MIN = 60_000;
const DAY = 86_400_000;
const MIN_EASE = 1.3;
const MAX_EASE = 3.0;

export function newSrs(): SrsState {
  return { interval: 0, ease: 2.5, reps: 0, lapses: 0 };
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function clampEase(e: number) {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, Math.round(e * 100) / 100));
}

export interface SrsResult {
  srs: SrsState;
  due: number;
}

/**
 * SM-2를 단순화한 간격 반복.
 * - 배우는 중(interval 0): 다시 1분 뒤, 어려움 10분 뒤, 알맞음 1일, 쉬움 4일
 * - 복습 단계: 다시는 처음부터(실수 기록), 나머지는 간격 × 쉬움 정도
 * 하루 이상 간격은 그날 0시부터 보이게 해서, 밤에 공부해도 다음 날 아침에 복습할 수 있다.
 */
export function review(state: SrsState, rating: Rating, now = Date.now()): SrsResult {
  let { interval, ease } = state;
  const { reps, lapses } = state;

  if (interval === 0) {
    if (rating === 1) return { srs: { ...state, reps, lastReview: now }, due: now + MIN };
    if (rating === 2) return { srs: { ...state, lastReview: now }, due: now + 10 * MIN };
    interval = rating === 3 ? 1 : 4;
    if (rating === 4) ease = clampEase(ease + 0.15);
  } else {
    if (rating === 1) {
      return {
        srs: { interval: 0, ease: clampEase(ease - 0.2), reps: reps + 1, lapses: lapses + 1, lastReview: now },
        due: now + MIN,
      };
    }
    if (rating === 2) {
      interval = Math.max(interval + 1, Math.round(interval * 1.2));
      ease = clampEase(ease - 0.15);
    } else if (rating === 3) {
      interval = Math.max(interval + 1, Math.round(interval * ease));
    } else {
      interval = Math.max(interval + 2, Math.round(interval * ease * 1.3));
      ease = clampEase(ease + 0.15);
    }
  }
  interval = Math.min(interval, 365);
  return {
    srs: { interval, ease, reps: reps + 1, lapses, lastReview: now },
    due: startOfDay(now) + interval * DAY,
  };
}

/** 버튼 아래에 보여줄 다음 복습 시점 */
export function previewLabel(state: SrsState, rating: Rating, now = Date.now()): string {
  const { due } = review(state, rating, now);
  const diff = due - now;
  if (diff < 60 * MIN) return `${Math.max(1, Math.round(diff / MIN))}분`;
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
  if (days < 30) return `${days}일`;
  return `${Math.round(days / 30)}달`;
}
