/**
 * 교과서 출판사 목록 (중·고등학교 국·영·수·사·과에서 자주 쓰는 곳).
 * 학교마다 고른 교과서가 달라서, AI 학습실에서 자료를 만들 때 출판사와 단원을 함께 적어
 * 자료 모음을 "학년 · 과목 · 출판사 · 연도 · 단원"으로 나눠 모은다.
 * 목록에 없으면 '직접 입력'으로 쓴다.
 */
export const PUBLISHERS = [
  "천재교육",
  "비상교육",
  "미래엔",
  "동아출판",
  "지학사",
  "금성출판사",
  "좋은책신사고",
  "교학사",
  "창비",
  "해냄에듀",
  "NE능률",
  "YBM",
  "씨마스",
  "visang",
] as const;

/** 출판사를 모르거나 공통 내용일 때 */
export const PUBLISHER_UNKNOWN = "공통(출판사 모름)";

/** 교과서 연도 고르기: 올해부터 4년 전까지 */
export function textbookYears(now = new Date()): number[] {
  const y = now.getFullYear();
  return [y, y - 1, y - 2, y - 3, y - 4];
}

/** "중1 · 수학 · 천재교육 · 2026 · 다항식의 연산" 같은 분류 글자 (빈 칸은 뺀다) */
export function classificationLabel(parts: { grade?: string; subject?: string; publisher?: string; year?: number | null; unit?: string }): string {
  return [parts.grade, parts.subject, parts.publisher, parts.year ? String(parts.year) : "", parts.unit].filter((x) => x && String(x).trim()).join(" · ");
}
