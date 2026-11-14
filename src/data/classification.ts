/**
 * 자료 분류 글자. 평소 공부는 출판사를 나누지 않고 통합 교육과정으로 보므로
 * "학년 · 과목 · 단원"만 쓴다. (예전 자료에 남은 출판사·연도 값은 보여 주지 않는다)
 */
export function classificationLabel(parts: { grade?: string; subject?: string; unit?: string }): string {
  return [parts.grade, parts.subject, parts.unit].filter((x) => x && String(x).trim()).join(" · ");
}
