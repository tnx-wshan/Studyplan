import { addDays, daysBetween, parseDateKey } from "@/lib/date";
import type { TaskKind } from "@/lib/db/types";

export interface ExamPlanInput {
  startDate: string;
  examDate: string;
  ranges: { subjectId: string; units: string[] }[];
  minutesPerDay: number;
  restDays: number[];
}

export interface TaskDraft {
  date: string;
  subjectId: string;
  title: string;
  kind: TaskKind;
  unit?: string;
  estimatedMinutes: number;
}

export interface ExamPlan {
  tasks: TaskDraft[];
  studyDays: string[];
  learnDays: number;
  reviewDays: number;
  hasFinalDay: boolean;
  /** 계획을 세울 수 없을 때 이유 */
  problem?: "no-days" | "no-units";
}

const MIN_TASK_MINUTES = 15;

/** 시험 전날까지 공부할 수 있는 날 (쉬는 요일 제외) */
export function studyDaysBetween(startDate: string, examDate: string, restDays: number[]): string[] {
  const days: string[] = [];
  const total = daysBetween(startDate, examDate);
  for (let i = 0; i < total; i++) {
    const d = addDays(startDate, i);
    if (!restDays.includes(parseDateKey(d).getDay())) days.push(d);
  }
  return days;
}

/** 과목을 번갈아 섞는다 (교차 학습): 국1, 수1, 영1, 국2, 수2 ... */
export function interleave(ranges: { subjectId: string; units: string[] }[]) {
  const out: { subjectId: string; unit: string }[] = [];
  const longest = Math.max(0, ...ranges.map((r) => r.units.length));
  for (let i = 0; i < longest; i++) {
    for (const r of ranges) if (r.units[i] !== undefined) out.push({ subjectId: r.subjectId, unit: r.units[i] });
  }
  return out;
}

/**
 * 시험 D-day 역산 계획.
 * 공부할 수 있는 날을 [개념 학습 ~75%] → [범위 복습 ~25%] → [전날 총정리]로 나누고,
 * 개념 학습 단원은 과목을 번갈아 가며 남은 날에 고르게 배분한다.
 */
export function generateExamPlan(input: ExamPlanInput): ExamPlan {
  const ranges = input.ranges.filter((r) => r.units.length > 0);
  const studyDays = studyDaysBetween(input.startDate, input.examDate, input.restDays);
  const empty = { tasks: [], studyDays, learnDays: 0, reviewDays: 0, hasFinalDay: false };
  if (ranges.length === 0) return { ...empty, problem: "no-units" };
  if (studyDays.length === 0) return { ...empty, problem: "no-days" };

  const n = studyDays.length;
  const hasFinalDay = n >= 2;
  let reviewDays = n >= 4 ? Math.max(1, Math.round(n * 0.25)) : 0;
  let learnDays = n - reviewDays - (hasFinalDay ? 1 : 0);
  if (learnDays < 1) {
    learnDays = n - (hasFinalDay ? 1 : 0);
    reviewDays = 0;
  }

  const tasks: TaskDraft[] = [];
  const minutes = Math.max(MIN_TASK_MINUTES, input.minutesPerDay);

  // 1) 개념 학습
  const queue = interleave(ranges);
  let cursor = 0;
  for (let d = 0; d < learnDays; d++) {
    const remainingDays = learnDays - d;
    const count = Math.ceil((queue.length - cursor) / remainingDays);
    if (count === 0) continue;
    const per = Math.max(MIN_TASK_MINUTES, Math.floor(minutes / count / 5) * 5);
    for (let k = 0; k < count; k++) {
      const item = queue[cursor++];
      tasks.push({ date: studyDays[d], subjectId: item.subjectId, title: item.unit, kind: "learn", unit: item.unit, estimatedMinutes: per });
    }
  }

  // 2) 범위 복습: 과목을 돌아가며, 과목마다 최소 한 번
  const subjects = ranges.map((r) => r.subjectId);
  if (reviewDays > 0) {
    const perDay = Math.min(subjects.length, Math.max(1, Math.ceil((subjects.length * 2) / reviewDays)));
    let s = 0;
    for (let d = 0; d < reviewDays; d++) {
      const date = studyDays[learnDays + d];
      const per = Math.max(MIN_TASK_MINUTES, Math.floor(minutes / perDay / 5) * 5);
      for (let k = 0; k < perDay; k++) {
        tasks.push({
          date,
          subjectId: subjects[s++ % subjects.length],
          title: "범위 복습 (백지 복습 · 오답 다시 풀기)",
          kind: "review",
          estimatedMinutes: per,
        });
      }
    }
  }

  // 3) 시험 전날 총정리
  if (hasFinalDay) {
    const date = studyDays[n - 1];
    const per = Math.max(MIN_TASK_MINUTES, Math.floor(minutes / subjects.length / 5) * 5);
    for (const subjectId of subjects) {
      tasks.push({ date, subjectId, title: "총정리 (핵심 개념 · 오답 훑어보기)", kind: "final", estimatedMinutes: per });
    }
  }

  return { tasks, studyDays, learnDays, reviewDays, hasFinalDay };
}
