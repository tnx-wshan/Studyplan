/** 단답형 비교용: 공백·대소문자·문장부호·전각 문자 차이를 없앤다 */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\$|\\,|\\ /g, "")
    .replace(/[\s.,·。、!?'"`()[\]{}]/g, "")
    .replace(/(입니다|이다|다|임)$/u, "");
}

export type GradeResult = "correct" | "wrong" | "self";

/**
 * 자동 채점. 객관식은 보기가 같으면 정답, 단답형은 표기 차이를 무시하고 비교한다.
 * 서술형은 자동으로 채점하지 않고 학생이 모범 답안과 비교해 스스로 채점한다("self").
 */
export function gradeAnswer(q: { type: "multiple" | "short" | "essay"; answer: string }, userAnswer: string): GradeResult {
  if (q.type === "essay") return "self";
  if (q.type === "multiple") return userAnswer === q.answer ? "correct" : "wrong";
  const user = normalizeAnswer(userAnswer);
  if (!user) return "wrong";
  // 정답이 "2, 3" 또는 "2 또는 3" 처럼 여러 개면 순서와 상관없이 모두 있어야 정답
  const parts = (s: string) =>
    s
      .split(/,|또는|or|\/|그리고/i)
      .map(normalizeAnswer)
      .filter(Boolean)
      .sort()
      .join("|");
  return user === normalizeAnswer(q.answer) || parts(userAnswer) === parts(q.answer) ? "correct" : "wrong";
}
