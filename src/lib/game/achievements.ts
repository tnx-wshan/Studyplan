import type { Exam, Task } from "@/lib/db/types";
import type { ReportStats } from "@/lib/study/report";

// ───────── 주간 퀘스트 ─────────

export interface WeeklyInput {
  stats: ReportStats;
  reflectionWritten: boolean;
}

export interface WeeklyQuest {
  id: string;
  icon: string;
  title: string;
  noirTitle: string;
  target: number;
  reward: number;
  value: (w: WeeklyInput) => number;
}

export const WEEKLY_QUESTS: WeeklyQuest[] = [
  { id: "wfocus", icon: "⏱️", title: "이번 주 300분 집중하기", noirTitle: "300분의 침묵", target: 300, reward: 1000, value: (w) => w.stats.totalMinutes },
  { id: "wdays", icon: "📅", title: "이번 주 5일 공부하기", noirTitle: "닷새의 기록", target: 5, reward: 1000, value: (w) => w.stats.studyDays },
  { id: "wwrong", icon: "📝", title: "오답 10번 다시 풀기", noirTitle: "약점 재심문 10회", target: 10, reward: 600, value: (w) => w.stats.wrongRetried },
  { id: "wmethod", icon: "💡", title: "학습법 3번 실습하기", noirTitle: "방법론 실습 3회", target: 3, reward: 600, value: (w) => w.stats.methodPractices.reduce((s, m) => s + m.count, 0) },
  { id: "wreflect", icon: "✍️", title: "주간 회고 쓰기", noirTitle: "주간 보고서 제출", target: 1, reward: 400, value: (w) => (w.reflectionWritten ? 1 : 0) },
];

// ───────── 시험 대비 퀘스트 ─────────

export const EXAM_MILESTONES = [
  { pct: 25, reward: 400, title: "준비의 시작", noirTitle: "1막: 착수" },
  { pct: 50, reward: 600, title: "반환점 돌파", noirTitle: "2막: 반환점" },
  { pct: 75, reward: 800, title: "마무리 단계", noirTitle: "3막: 결전 전야" },
  { pct: 100, reward: 1200, title: "모든 계획 완료", noirTitle: "종막: 완수" },
];

export function examProgress(exam: Exam, tasks: Task[]) {
  const main = tasks.filter((t) => t.examId === exam.id && t.kind !== "spaced");
  const done = main.filter((t) => t.done).length;
  return { done, total: main.length, pct: main.length ? Math.floor((done / main.length) * 100) : 0 };
}

export const examQuestId = (examId: string, pct: number) => `exam:${examId}:${pct}`;

// ───────── 업적 ─────────

export interface Totals {
  longestStreak: number;
  totalMinutes: number;
  cardsReviewed: number;
  wrongMastered: number;
  quizzesFinished: number;
  methodsTried: number;
  reflections: number;
  level: number;
  tasksDone: number;
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  noirName: string;
  description: string;
  tier: 1 | 2 | 3;
  /** 진행 값과 목표 */
  metric: keyof Totals;
  target: number;
}

export const BADGES: Badge[] = [
  { id: "streak3", icon: "🔥", name: "3일 연속", noirName: "불씨", description: "3일 연속 공부", tier: 1, metric: "longestStreak", target: 3 },
  { id: "streak7", icon: "🕯️", name: "일주일 개근", noirName: "꺼지지 않는 등불", description: "7일 연속 공부", tier: 2, metric: "longestStreak", target: 7 },
  { id: "streak30", icon: "🌕", name: "한 달 개근", noirName: "불멸의 기록", description: "30일 연속 공부", tier: 3, metric: "longestStreak", target: 30 },
  { id: "focus10", icon: "⏳", name: "집중 10시간", noirName: "첫 번째 장부", description: "집중 타이머로 누적 10시간", tier: 1, metric: "totalMinutes", target: 600 },
  { id: "focus50", icon: "📜", name: "집중 50시간", noirName: "묵직한 장부", description: "집중 타이머로 누적 50시간", tier: 2, metric: "totalMinutes", target: 3000 },
  { id: "focus100", icon: "🏛️", name: "집중 100시간", noirName: "백 시간의 서약", description: "집중 타이머로 누적 100시간", tier: 3, metric: "totalMinutes", target: 6000 },
  { id: "cards100", icon: "🃏", name: "카드 100장", noirName: "기억 수집가", description: "복습 카드 100번 넘기기", tier: 1, metric: "cardsReviewed", target: 100 },
  { id: "cards500", icon: "🗃️", name: "카드 500장", noirName: "기억의 서고", description: "복습 카드 500번 넘기기", tier: 2, metric: "cardsReviewed", target: 500 },
  { id: "wrong10", icon: "🎯", name: "오답 정복 10", noirName: "약점 사냥꾼", description: "오답 10개 정복", tier: 1, metric: "wrongMastered", target: 10 },
  { id: "wrong50", icon: "⚔️", name: "오답 정복 50", noirName: "오답 처형인", description: "오답 50개 정복", tier: 3, metric: "wrongMastered", target: 50 },
  { id: "quiz10", icon: "🧪", name: "퀴즈 10회", noirName: "시험관", description: "AI 퀴즈 10번 끝까지 풀기", tier: 1, metric: "quizzesFinished", target: 10 },
  { id: "methods5", icon: "🧭", name: "학습법 탐험가", noirName: "방법론자", description: "서로 다른 학습법 5가지 실습", tier: 2, metric: "methodsTried", target: 5 },
  { id: "reflect4", icon: "🪞", name: "회고 4주", noirName: "자기 성찰", description: "주간 회고 4번 쓰기", tier: 2, metric: "reflections", target: 4 },
  { id: "tasks100", icon: "✅", name: "할 일 100개", noirName: "실행가", description: "할 일 100개 완료", tier: 2, metric: "tasksDone", target: 100 },
  { id: "level10", icon: "⭐", name: "레벨 10", noirName: "각성자", description: "레벨 10 달성", tier: 2, metric: "level", target: 10 },
  { id: "level20", icon: "👑", name: "레벨 20", noirName: "완전 각성", description: "레벨 20 달성", tier: 3, metric: "level", target: 20 },
];

export function badgeById(id?: string) {
  return BADGES.find((b) => b.id === id);
}

export function earnedBadges(t: Totals): string[] {
  return BADGES.filter((b) => t[b.metric] >= b.target).map((b) => b.id);
}

export function badgeProgress(b: Badge, t: Totals) {
  return Math.min(1, t[b.metric] / b.target);
}

export const TIER_LABELS = { 1: { cute: "브론즈", noir: "III" }, 2: { cute: "실버", noir: "II" }, 3: { cute: "골드", noir: "I" } } as const;
