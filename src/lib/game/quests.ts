export interface DailyStats {
  focusMinutes: number;
  tasksDone: number;
  cardsReviewed: number;
  wrongRetried: number;
}

export interface QuestDef {
  id: string;
  icon: string;
  title: string;
  target: number;
  reward: number;
  stat: keyof DailyStats;
  href: string;
}

export const DAILY_QUESTS: QuestDef[] = [
  { id: "focus25", icon: "⏱️", title: "집중 타이머로 25분 공부하기", target: 25, reward: 25, stat: "focusMinutes", href: "/timer" },
  { id: "tasks3", icon: "✅", title: "오늘 할 일 3개 끝내기", target: 3, reward: 30, stat: "tasksDone", href: "/planner" },
  { id: "cards10", icon: "🃏", title: "복습 카드 10장 넘기기", target: 10, reward: 20, stat: "cardsReviewed", href: "/review/cards" },
  { id: "wrong1", icon: "📝", title: "오답 1개 다시 풀기", target: 1, reward: 15, stat: "wrongRetried", href: "/review/wrong" },
];

export function questProgress(q: QuestDef, stats: DailyStats) {
  const value = stats[q.stat];
  return { value: Math.min(value, q.target), done: value >= q.target, ratio: Math.min(1, value / q.target) };
}
