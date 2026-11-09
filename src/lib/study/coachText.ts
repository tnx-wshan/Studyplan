import { methodById } from "@/data/methods";
import type { ReportStats } from "./report";

const REASON_LABELS = { concept: "개념 부족", mistake: "실수", time: "시간 부족", other: "기타" } as const;

/** AI 코치에게 보낼 공부 기록 요약 (개인 정보 없이 숫자와 과목 이름만) */
export function reportToText(now: ReportStats, before: ReportStats, subjectName: (id: string) => string): string {
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "-");
  const lines = [
    `공부한 날: ${now.studyDays}/${now.days}일 (지난 기간 ${before.studyDays}일)`,
    `집중 시간: ${now.totalMinutes}분 (지난 기간 ${before.totalMinutes}분)`,
    `과목별 집중 시간: ${now.bySubject.length ? now.bySubject.map((s) => `${subjectName(s.subjectId)} ${s.minutes}분`).join(", ") : "기록 없음"}`,
    `계획: ${now.tasksDone}/${now.tasksPlanned}개 완료 (${pct(now.tasksDone, now.tasksPlanned)}, 지난 기간 ${pct(before.tasksDone, before.tasksPlanned)})`,
    `복습 카드: ${now.cardsReviewed}장 넘김 (지난 기간 ${before.cardsReviewed}장)`,
    `오답: 새로 기록 ${now.wrongAdded}개, 다시 풀기 ${now.wrongRetried}번, 정복 ${now.wrongMastered}개`,
    `틀린 이유: ${Object.entries(now.wrongByReason)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${REASON_LABELS[k as keyof typeof REASON_LABELS]} ${n}`)
      .join(", ") || "기록 없음"}`,
    `AI 퀴즈 정답률: ${now.quizTotal ? `${now.quizCorrect}/${now.quizTotal} (${pct(now.quizCorrect, now.quizTotal)})` : "푼 퀴즈 없음"}`,
    `학습법 실습: ${now.methodPractices.length ? now.methodPractices.map((m) => `${methodById(m.methodId)?.name ?? m.methodId} ${m.count}번`).join(", ") : "없음"}`,
    `요일별 집중(분): ${now.byDay.map((d) => d.minutes).join(" / ")}`,
  ];
  return lines.join("\n");
}
