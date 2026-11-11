import { isQuestion, type CourseOutline, type Step } from "./types";

/**
 * 한 유닛을 푸는 순서. 듀오링고처럼 틀린 문제는 끝에 한 번 더 나온다.
 * 화면 상태와 떼어 놓아 시험할 수 있게 한다.
 */
export interface LessonState {
  /** 풀 단계 번호들 (steps의 index). 틀린 문제는 뒤에 다시 붙는다 */
  queue: number[];
  pos: number;
  /** 처음 풀 때의 결과 */
  firstTry: Record<number, boolean>;
  /** 다시 넣은 문제 */
  requeued: number[];
}

export function startLesson(steps: Step[]): LessonState {
  return { queue: steps.map((_, i) => i), pos: 0, firstTry: {}, requeued: [] };
}

export function currentStep(state: LessonState): number | undefined {
  return state.queue[state.pos];
}

/** 답을 기록한다. 처음 틀린 문제는 한 번만 뒤에 다시 넣는다 */
export function recordResult(state: LessonState, stepIndex: number, correct: boolean): LessonState {
  const first = !(stepIndex in state.firstTry);
  const firstTry = first ? { ...state.firstTry, [stepIndex]: correct } : state.firstTry;
  const requeue = !correct && !state.requeued.includes(stepIndex);
  return {
    ...state,
    firstTry,
    queue: requeue ? [...state.queue, stepIndex] : state.queue,
    requeued: requeue ? [...state.requeued, stepIndex] : state.requeued,
  };
}

export function advance(state: LessonState): LessonState {
  return { ...state, pos: state.pos + 1 };
}

export function isFinished(state: LessonState): boolean {
  return state.pos >= state.queue.length;
}

/** 진행 막대: 처음 순서의 단계를 몇 개 지났는지 + 다시 푼 문제 */
export function lessonProgress(state: LessonState): number {
  return state.queue.length === 0 ? 1 : Math.min(1, state.pos / state.queue.length);
}

export interface LessonScore {
  correct: number;
  total: number;
}

export function lessonScore(steps: Step[], state: LessonState): LessonScore {
  const questions = steps.map((s, i) => (isQuestion(s) ? i : -1)).filter((i) => i >= 0);
  return { correct: questions.filter((i) => state.firstTry[i]).length, total: questions.length };
}

/** 유닛 경험치: 처음 끝내면 10 + 처음에 맞힌 문제당 2, 다시 하면 5 */
export function lessonXp(score: LessonScore, firstCompletion: boolean): number {
  return firstCompletion ? 10 + score.correct * 2 : 5;
}

/** 공부 시간이 부풀지 않도록 단계당 최대 90초로 센다 */
export function cappedSeconds(startedAt: number, endedAt: number, stepCount: number): number {
  const raw = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  return Math.min(raw, Math.max(1, stepCount) * 90);
}

// ───────── 학습 지도 ─────────

export type UnitState = "done" | "current" | "open" | "locked";

/**
 * 코스의 유닛 상태. 섹션 순서대로 이어서 하고, 아직 끝내지 않은 첫 유닛이 '지금 할 유닛'이다.
 * 그보다 앞은 모두 열려 있고, 뒤는 잠겨 있다 (끝낸 유닛은 언제든 다시 할 수 있다).
 */
export function unitStates(outline: Pick<CourseOutline, "sections">, done: Set<string>): Map<string, UnitState> {
  const ids = outline.sections.flatMap((s) => s.units.map((u) => u.id));
  const firstOpen = ids.findIndex((id) => !done.has(id));
  const map = new Map<string, UnitState>();
  ids.forEach((id, i) => {
    if (done.has(id)) map.set(id, "done");
    else if (i === firstOpen) map.set(id, "current");
    else if (firstOpen === -1 || i < firstOpen) map.set(id, "open");
    else map.set(id, "locked");
  });
  return map;
}

/** 다음에 할 유닛 id */
export function nextUnitId(outline: Pick<CourseOutline, "sections">, done: Set<string>, after?: string): string | undefined {
  const ids = outline.sections.flatMap((s) => s.units.map((u) => u.id));
  if (after) {
    const i = ids.indexOf(after);
    const later = ids.slice(i + 1).find((id) => !done.has(id));
    if (later) return later;
  }
  return ids.find((id) => !done.has(id));
}
