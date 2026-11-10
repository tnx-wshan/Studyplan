import type { Exam } from "@/lib/db/types";

export interface TrendPoint {
  examId: string;
  title: string;
  date: string;
  score: number;
  goal?: number;
}

export interface TrendSeries {
  subjectId: string;
  points: TrendPoint[];
  /** 가장 최근 점수 - 그 전 점수 (기록이 2개 이상일 때) */
  change: number | null;
}

/** 결과를 기록한 시험들을 날짜순으로 과목별 점수 추이로 바꾼다 */
export function examTrend(exams: Exam[]): TrendSeries[] {
  const sorted = exams.filter((e) => e.results && Object.keys(e.results).length > 0).sort((a, b) => a.date.localeCompare(b.date));
  const map = new Map<string, TrendPoint[]>();
  for (const e of sorted) {
    for (const [subjectId, score] of Object.entries(e.results!)) {
      const list = map.get(subjectId) ?? [];
      list.push({ examId: e.id, title: e.title, date: e.date, score, goal: e.goals?.[subjectId] });
      map.set(subjectId, list);
    }
  }
  return [...map.entries()].map(([subjectId, points]) => ({
    subjectId,
    points,
    change: points.length >= 2 ? points.at(-1)!.score - points.at(-2)!.score : null,
  }));
}

/** 목표를 세운 과목 중 달성한 과목 수 */
export function goalsMet(exam: Pick<Exam, "goals" | "results">): { met: number; total: number } {
  const ids = Object.keys(exam.goals ?? {}).filter((id) => exam.results?.[id] !== undefined);
  return { met: ids.filter((id) => exam.results![id] >= exam.goals![id]).length, total: ids.length };
}

export function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
