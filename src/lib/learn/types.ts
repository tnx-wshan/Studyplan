import type { GradeId, SubjectGroup } from "@/data/curriculum";

/**
 * 학습 코스의 과목. 기본 5과목(korean·english·math·social·science)은 모든 학년에 있고,
 * 관리자가 학년마다 과목을 더 만들 수 있다(수학2, 역사, 체육 …). 열쇠(key)는 기본 과목이면 그 id, 추가한 과목이면 's-…'.
 */
export interface LearnSubject {
  key: string;
  grade: GradeId;
  name: string;
  /** 아이콘에 쓰는 한두 글자 */
  short: string;
  color: string;
  /** 비슷한 기본 과목: 수식 도구, 자료 모음 재료 추천, 교육과정 대표 단원에 쓴다 (없으면 null) */
  group: SubjectGroup | null;
  builtIn: boolean;
  /** 공개된 유닛 수 (관리 도구는 초안 포함) */
  units: number;
}

/**
 * '학습' 탭(듀오링고식 코스)의 데이터 구조.
 * 서버(관리 도구, 학습 과정 DB)와 화면이 함께 쓰므로 "use client"가 없는 일반 모듈에 둔다.
 *
 * 코스 = 학년 × 과목, 섹션 = 과목의 목차(대단원), 유닛 = 2~3분 분량의 한 번 학습.
 */

/** 핵심 정리: 짧게 읽고 넘어간다 */
export interface SummaryStep {
  type: "summary";
  title: string;
  /** 마크다운, 수식은 $...$ */
  body: string;
  /** 꼭 기억할 점 */
  points: string[];
}

/** 객관식 */
export interface ChoiceStep {
  type: "choice";
  prompt: string;
  choices: string[];
  /** 정답 보기의 글자 그대로 */
  answer: string;
  explanation: string;
}

/** 주관식(단답형). 여러 표현을 정답으로 받을 수 있다 */
export interface ShortStep {
  type: "short";
  prompt: string;
  answers: string[];
  explanation: string;
  /** 수식 도구를 기본으로 펼친다 */
  math?: boolean;
}

/**
 * 빈칸 채우기. text 안의 [[정답]]이 빈칸이 된다.
 * 학생은 낱말 상자(정답 + distractors)에서 골라 채운다.
 */
export interface BlankStep {
  type: "blank";
  prompt: string;
  text: string;
  distractors: string[];
  explanation: string;
}

/** 낱말 퍼즐: 뜻풀이를 보고 흩어진 글자 조각을 순서대로 눌러 낱말을 완성한다 */
export interface PuzzleStep {
  type: "puzzle";
  /** 뜻풀이(힌트) */
  prompt: string;
  answer: string;
  /** 헷갈리게 섞어 넣을 글자 */
  decoys: string;
  explanation: string;
}

export type Step = SummaryStep | ChoiceStep | ShortStep | BlankStep | PuzzleStep;
export type QuestionStep = Exclude<Step, SummaryStep>;
export type StepType = Step["type"];

export const STEP_LABELS: Record<StepType, string> = {
  summary: "핵심 정리",
  choice: "객관식",
  short: "주관식",
  blank: "빈칸 채우기",
  puzzle: "낱말 퍼즐",
};

export type UnitStatus = "draft" | "published";

export interface LearnUnit {
  id: string;
  sectionId: string;
  order: number;
  title: string;
  /** 예상 시간(분) */
  minutes: number;
  status: UnitStatus;
  steps: Step[];
  /** 이 유닛을 만들 때 쓴 자료 모음 항목 */
  sourceIds: string[];
  updatedAt: number;
}

export interface LearnSection {
  id: string;
  grade: GradeId;
  subject: string;
  order: number;
  title: string;
  description: string;
}

/** 학습 지도에 쓰는 유닛 요약 (문제 내용 없이) */
export interface UnitBrief {
  id: string;
  title: string;
  minutes: number;
  questionCount: number;
  status: UnitStatus;
}

export interface CourseOutline {
  grade: GradeId;
  subject: string;
  sections: (LearnSection & { units: UnitBrief[] })[];
}

export interface CourseInfo {
  grade: GradeId;
  subject: string;
  units: number;
}

export const courseKey = (grade: string, subject: string) => `${grade}:${subject}`;

/** 하루 학습 목표(분) 기본값 */
export const DEFAULT_LEARN_GOAL = 5;

export function isQuestion(step: Step): step is QuestionStep {
  return step.type !== "summary";
}
