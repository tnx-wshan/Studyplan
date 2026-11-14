/**
 * 레벨과 경험치 (2026-11 개편).
 * - 레벨은 0부터 20까지. 0 → 1에 10,000 XP, 그 뒤로는 레벨마다 5,000 XP씩 더 필요하다.
 *   (누적: 1레벨 10,000 · 2레벨 25,000 · 3레벨 45,000 … 20레벨 1,150,000)
 * - 경험치는 예전보다 10배 크게 준다 (XP_REWARDS). 예전 기록은 기기 DB 6번째 버전에서 10배로 바꿨다.
 */
export const MAX_LEVEL = 20;
/** 예전(1~) 레벨 체계보다 경험치를 몇 배로 주는지 (예전 기록·백업 변환용) */
export const XP_SCALE = 10;

/** 레벨 n에서 n+1로 가는 데 필요한 경험치 (n = 0 … 19) */
export function xpToNext(level: number): number {
  return 10_000 + 5_000 * Math.max(0, level);
}

/** 레벨 n이 시작되는 누적 경험치 */
export function xpForLevel(level: number): number {
  const n = Math.max(0, Math.min(MAX_LEVEL, Math.floor(level)));
  // 10,000·n + 5,000·(0+1+…+(n-1))
  return 10_000 * n + 2_500 * n * (n - 1);
}

export interface LevelInfo {
  level: number;
  /** 현재 레벨 안에서 쌓은 경험치 */
  current: number;
  /** 다음 레벨까지 필요한 경험치(현재 레벨 구간 전체). 최고 레벨이면 0 */
  needed: number;
  progress: number; // 0~1
  /** 최고 레벨에 닿았는지 */
  max: boolean;
}

export function levelFromXp(totalXp: number): LevelInfo {
  let xp = Math.max(0, Math.floor(totalXp));
  let level = 0;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level >= MAX_LEVEL) return { level: MAX_LEVEL, current: xp, needed: 0, progress: 1, max: true };
  const needed = xpToNext(level);
  return { level, current: xp, needed, progress: xp / needed, max: false };
}

/** 활동별 기본 경험치 (예전의 10배) */
export const XP_REWARDS = {
  studyMinute: 10, // 공부 1분
  taskDone: 100, // 계획 하나 완료
  cardReviewed: 20, // 복습 카드 1장
  wrongAnswerRetried: 50, // 오답 재풀이
  quizCorrect: 30, // 퀴즈 정답
  dailyQuestDone: 300,
  reflectionWritten: 200,
  methodPractice: 150,
  examResult: 300,
} as const;

/** 경험치에서 코인: 경험치 100마다 1코인 (예전과 같은 물가) */
export const coinsForXp = (amount: number) => Math.floor(amount / 100);
