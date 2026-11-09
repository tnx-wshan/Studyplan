/** 레벨 n에서 n+1로 가는 데 필요한 경험치 */
export function xpToNext(level: number): number {
  return 100 + (level - 1) * 50;
}

export interface LevelInfo {
  level: number;
  /** 현재 레벨 안에서 쌓은 경험치 */
  current: number;
  /** 다음 레벨까지 필요한 경험치(현재 레벨 구간 전체) */
  needed: number;
  progress: number; // 0~1
}

export function levelFromXp(totalXp: number): LevelInfo {
  let xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  const needed = xpToNext(level);
  return { level, current: xp, needed, progress: xp / needed };
}

/** 활동별 기본 경험치 (1단계 이후 기능에서 사용) */
export const XP_REWARDS = {
  studyMinute: 1, // 공부 1분
  taskDone: 10, // 계획 하나 완료
  cardReviewed: 2, // 복습 카드 1장
  wrongAnswerRetried: 5, // 오답 재풀이
  quizCorrect: 3, // 퀴즈 정답
  dailyQuestDone: 30,
  reflectionWritten: 20,
  methodPractice: 15,
} as const;
