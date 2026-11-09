import type { PetSpecies } from "@/lib/game/pet";
import type { GradeId, SubjectGroup } from "@/data/curriculum";

/** 모든 레코드는 문자열 id와 생성·수정 시각을 가진다(나중에 서버 DB로 옮기기 쉽도록). */
interface Base {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface Profile extends Base {
  id: "me";
  nickname: string;
  grade: GradeId;
  goal: string;
  pet: { species: PetSpecies; name: string };
  totalXp: number;
  coins: number;
  theme: "system" | "light" | "dark";
  onboardedAt: number;
}

export interface Subject extends Base {
  name: string;
  group: SubjectGroup;
  color: string;
  courseId?: string; // curriculum 과목 연결
  archived?: boolean;
}

export interface Exam extends Base {
  title: string;
  date: string; // YYYY-MM-DD
  ranges: { subjectId: string; unitIds: string[]; note?: string }[];
}

export interface Task extends Base {
  date: string;
  subjectId?: string;
  title: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  done: boolean;
  order: number;
  examId?: string;
}

export interface StudySession extends Base {
  subjectId?: string;
  date: string;
  startedAt: number;
  endedAt: number;
  focusMinutes: number;
  mode: "pomodoro" | "free";
}

export interface Deck extends Base {
  name: string;
  subjectId?: string;
}

export interface Card extends Base {
  deckId: string;
  front: string;
  back: string;
  due: number;
  /** 간격 반복 알고리즘 상태 (1단계에서 구현) */
  srs: { stability: number; difficulty: number; reps: number; lapses: number; lastReview?: number };
}

export interface WrongAnswer extends Base {
  subjectId?: string;
  unitId?: string;
  question: string;
  imageId?: string;
  myAnswer: string;
  correctAnswer: string;
  reason: "concept" | "mistake" | "time" | "other";
  note?: string;
  nextRetry: number;
  retries: { at: number; correct: boolean }[];
}

export interface Material extends Base {
  kind: "web" | "photo" | "pdf" | "curriculum";
  title: string;
  subjectId?: string;
  extractedText?: string;
  sourceUrl?: string;
  blob?: Blob;
}

export interface Quiz extends Base {
  title: string;
  materialIds: string[];
  subjectId?: string;
}

export interface Question extends Base {
  quizId: string;
  type: "multiple" | "short" | "essay";
  prompt: string;
  choices?: string[];
  answer: string;
  explanation: string;
  sources?: string[];
}

export interface TutorChat extends Base {
  title: string;
  mode: "hint" | "solution";
  subjectId?: string;
}

export interface TutorMessage extends Base {
  chatId: string;
  role: "user" | "assistant";
  content: string;
  imageIds?: string[];
}

export interface UserQuest extends Base {
  questId: string;
  period: string; // 일일: YYYY-MM-DD, 주간: YYYY-Www
  progress: number;
  completedAt?: number;
}

export interface UserBadge extends Base {
  badgeId: string;
}

export interface Reflection extends Base {
  week: string; // YYYY-Www
  good: string;
  bad: string;
  nextGoal: string;
}

export interface AiUsage {
  id: string; // `${date}:${feature}`
  date: string;
  feature: "tutor" | "quiz";
  count: number;
}

export interface XpEvent {
  id: string;
  at: number;
  date: string;
  amount: number;
  reason: string;
}
