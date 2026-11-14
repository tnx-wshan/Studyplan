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
  /** 화면 스타일: cute(밝고 귀여운) / noir(어둡고 절제된). 없으면 noir */
  style?: "cute" | "noir";
  /** 상점에서 산 꾸미기 아이템 id */
  owned?: string[];
  /** 착용 중인 꾸미기 */
  equipped?: { accessory?: string; background?: string };
  /** 칭호로 쓰는 업적 id */
  titleBadge?: string;
  /** 연속 기록 보호권 개수 (최대 2) */
  freezes?: number;
  /** 보호권을 쓴 날짜들 */
  frozenDays?: string[];
  /** 오래 쉬었다 돌아온 날 (복귀 환영 표시용) */
  comeback?: { date: string; awayDays: number };
  /** 읽은 동료의 기록 (테마 공통 키) */
  readRecords?: string[];
  /** 주간 집중 목표(분): 주 키 → 목표 */
  weeklyGoals?: Record<string, number>;
  /** 하루에 새로 배우는 카드 수 상한 (기본 20) */
  newCardLimit?: number;
  /** 오늘 새로 배운 카드 수 */
  newCardsToday?: { date: string; count: number };
  onboardedAt: number;
  /** 레벨이 올랐지만 아직 축하 화면을 보지 않았을 때, 오르기 전 레벨 */
  levelUpFrom?: number;
  /** 서버(관리 도구)에서 이 사용자를 알아보는 id. 처음 동기화할 때 만든다 */
  serverId?: string;
  /** 관리자가 내린 명령을 여기까지 적용했다 */
  lastCommandId?: number;
  /** 학습 탭에서 고른 코스 */
  learnCourse?: { grade: GradeId; subject: string };
  /** 학습 탭 하루 목표(분) */
  learnGoal?: number;
  /** 고른 대표 캐릭터 (없으면 테마의 대표) */
  character?: string;
  /** 학습 지도 꾸미기 */
  mapSkin?: "basic" | "lantern" | "gilded";
  /** 레벨업 보상을 여기까지 받았다 */
  rewardedLevel?: number;
  /** 학습 습관 진단 결과 */
  diagnosis?: { answers: Record<string, number>; scores: Record<string, number>; at: number };
}

export interface Subject extends Base {
  name: string;
  group: SubjectGroup;
  color: string;
  /** 연결한 교육과정 과목(Course.id). 이 과목들의 단원이 단원 목록이 된다. */
  courseIds: string[];
  /** 학생이 직접 추가한 단원 */
  customUnits: string[];
  archived?: boolean;
}

export interface Exam extends Base {
  title: string;
  date: string; // YYYY-MM-DD
  ranges: { subjectId: string; units: string[] }[];
  minutesPerDay: number;
  /** 쉬는 요일 (0=일 ~ 6=토) */
  restDays: number[];
  /** 과목별 목표 점수 (과목 id → 0~100) */
  goals?: Record<string, number>;
  /** 과목별 실제 점수 */
  results?: Record<string, number>;
  /** 시험 뒤 돌아보기 */
  resultNote?: { worked: string; change: string };
  resultAt?: number;
  resultXpGranted?: boolean;
}

export type TaskKind = "custom" | "learn" | "review" | "final" | "spaced";

export interface Task extends Base {
  date: string;
  subjectId?: string;
  title: string;
  kind: TaskKind;
  /** 학습·복습 대상 단원 */
  unit?: string;
  estimatedMinutes?: number;
  done: boolean;
  doneAt?: number;
  /** 완료 경험치를 이미 받았는지 (체크를 껐다 켜도 한 번만 지급) */
  xpGranted?: boolean;
  order: number;
  examId?: string;
  /** 간격 복습 할 일이 몇 번째 복습인지 (1·3·7·14일) */
  spacedStep?: number;
  /** 집중 타이머로 이 할 일에 쓴 실제 시간(분) */
  actualMinutes?: number;
  /** 루틴에서 만들어진 할 일 */
  routineId?: string;
  /** 시작 시각 "HH:MM" (루틴) */
  time?: string;
}

/** 매주 반복하는 고정 공부 루틴 */
export interface Routine extends Base {
  title: string;
  subjectId?: string;
  minutes: number;
  /** 요일 (0=일 ~ 6=토) */
  days: number[];
  /** 시작 시각 "HH:MM" (없으면 시각 없이) */
  time?: string;
  active: boolean;
  /** 이 날짜까지는 할 일을 이미 만들었다 */
  generatedThrough?: string;
}

export interface StudySession extends Base {
  subjectId?: string;
  /** 타이머에 연결했던 할 일 */
  taskId?: string;
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
  srs: SrsState;
}

/** SM-2 기반 간격 반복 상태 */
export interface SrsState {
  /** 다음 복습까지 간격(일). 0이면 아직 배우는 중 */
  interval: number;
  /** 쉬움 정도 (1.3 ~ 3.0) */
  ease: number;
  reps: number;
  lapses: number;
  lastReview?: number;
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
  /** 다음에 다시 풀 날짜 YYYY-MM-DD */
  nextRetry: string;
  /** 연속으로 맞힌 횟수 */
  streak: number;
  mastered: boolean;
  retries: { at: number; correct: boolean }[];
}

export interface StoredImage {
  id: string;
  blob: Blob;
  createdAt: number;
}

export interface Material extends Base {
  kind: "web" | "photo" | "pdf" | "curriculum";
  title: string;
  subjectId?: string;
  /** AI가 정리한 개념 (마크다운) */
  summary: string;
  keyPoints: string[];
  sources: { title: string; url: string }[];
  /** 웹 검색어, 단원 이름 등 */
  query?: string;
  /** 예전 버전에서 저장한 교과서 출판사와 연도 (이제 쓰지 않는다: 출판사 구분 없이 통합 과정) */
  publisher?: string;
  year?: number;
}

export interface Quiz extends Base {
  title: string;
  materialIds: string[];
  subjectId?: string;
  difficulty: "easy" | "normal" | "hard";
  /** 정답 검산을 거쳤는지 */
  verified: boolean;
  /** 만든 AI (예: Google Gemini) */
  madeBy: string;
  attempts: { at: number; score: number; total: number }[];
}

export interface Question extends Base {
  quizId: string;
  order: number;
  type: "multiple" | "short" | "essay";
  prompt: string;
  choices: string[];
  answer: string;
  explanation: string;
  concept: string;
  /** 이번 풀이에서 쓴 답과 채점 결과 */
  userAnswer?: string;
  result?: "correct" | "wrong";
  /** 한 번이라도 맞혀서 경험치를 받았는지 */
  xpGranted?: boolean;
  flagged?: boolean;
  savedToWrong?: boolean;
  savedToCard?: boolean;
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
  /** 답을 받지 못했을 때 오류 메시지 */
  error?: string;
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
  /** 이번 주 공부에 대한 만족도 1~5 */
  mood?: number;
  xpGranted?: boolean;
}

/** 학습법 실습 기록 */
export interface MethodLog extends Base {
  methodId: string;
  date: string;
  subjectId?: string;
  topic?: string;
  /** 실습 내용 (학습법마다 다름) */
  fields: Record<string, string>;
  /** 백지 복습: 떠올린 핵심 비율 0~100 */
  recall?: number;
  aiFeedback?: AiFeedback;
}

export interface AiFeedback {
  score: number;
  good: string[];
  missing: string[];
  misconceptions: string[];
  nextStep: string;
}

/** AI 주간 코칭 */
export interface CoachReport extends Base {
  /** 기간 키: YYYY-Www 또는 YYYY-MM */
  period: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendations: { methodId: string; reason: string }[];
  goals: string[];
  madeBy: string;
}

/** 학습 탭: 유닛별 진도 (id = 유닛 id) */
export interface LearnProgress extends Base {
  /** 학년:과목 */
  courseKey: string;
  title: string;
  completedAt: number;
  /** 가장 잘한 기록 (처음에 맞힌 문제 수) */
  bestCorrect: number;
  total: number;
  attempts: number;
  /** 관리자가 완료로 표시함 */
  byAdmin?: boolean;
}

/** 학습 탭: 한 번 학습한 기록 (하루 목표, 통계) */
export interface LearnLog {
  id: string;
  date: string;
  at: number;
  unitId: string;
  courseKey: string;
  seconds: number;
  correct: number;
  total: number;
  xp: number;
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
