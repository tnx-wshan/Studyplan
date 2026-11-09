/**
 * 학습 습관 진단.
 * '나는 어떤 유형인가'를 정하는 검사가 아니라, 지금 공부 습관에서 보완할 점을 찾는 자기 점검이다.
 */
export type Dimension = "plan" | "focus" | "review" | "retrieval" | "meta" | "motivation";

export const DIMENSIONS: Record<Dimension, { label: string; icon: string; low: string; methods: string[] }> = {
  plan: { label: "계획 세우기", icon: "🗓️", low: "계획이 막연하거나 자주 밀리는 편이에요.", methods: ["smallPlan", "pomodoro"] },
  focus: { label: "집중 유지", icon: "🎯", low: "공부하다 딴짓으로 새는 일이 잦은 편이에요.", methods: ["pomodoro", "smallPlan"] },
  review: { label: "복습 습관", icon: "🔁", low: "배운 뒤 다시 보는 일이 적은 편이에요.", methods: ["spaced", "errorAnalysis"] },
  retrieval: { label: "떠올리며 공부", icon: "🧠", low: "다시 읽기·밑줄 위주로 공부하는 편이에요.", methods: ["retrieval", "blank"] },
  meta: { label: "스스로 점검", icon: "🔍", low: "내가 아는 것과 모르는 것을 구분하기 어려운 편이에요.", methods: ["feynman", "blank", "selfExplain"] },
  motivation: { label: "꾸준함", icon: "🔥", low: "공부를 시작하기까지 오래 걸리거나 금방 그만두는 편이에요.", methods: ["smallPlan", "pomodoro"] },
};

export interface DiagnosisQuestion {
  id: string;
  dimension: Dimension;
  text: string;
  /** true면 '그렇다'일수록 점수가 낮다 */
  reverse?: boolean;
}

export const QUESTIONS: DiagnosisQuestion[] = [
  { id: "p1", dimension: "plan", text: "공부를 시작하기 전에 오늘 무엇을 할지 정해 둔다." },
  { id: "p2", dimension: "plan", text: "시험 범위가 나오면 언제 무엇을 공부할지 날짜별로 나눈다." },
  { id: "f1", dimension: "focus", text: "공부하는 동안 휴대폰을 자주 확인한다.", reverse: true },
  { id: "f2", dimension: "focus", text: "한 번 앉으면 20분 이상 한 가지 공부에 집중할 수 있다." },
  { id: "r1", dimension: "review", text: "수업에서 배운 내용을 그날이나 다음 날 다시 본다." },
  { id: "r2", dimension: "review", text: "주로 시험 직전에 몰아서 공부한다.", reverse: true },
  { id: "t1", dimension: "retrieval", text: "공부할 때 교과서나 필기를 여러 번 다시 읽는 게 대부분이다.", reverse: true },
  { id: "t2", dimension: "retrieval", text: "책을 덮고 기억나는 것을 말하거나 써 본다." },
  { id: "m1", dimension: "meta", text: "공부한 뒤 '이 부분은 아직 모르겠다'를 스스로 찾아낼 수 있다." },
  { id: "m2", dimension: "meta", text: "틀린 문제를 보면 왜 틀렸는지 원인을 생각해 본다." },
  { id: "v1", dimension: "motivation", text: "해야 할 공부를 자꾸 미루게 된다.", reverse: true },
  { id: "v2", dimension: "motivation", text: "공부 목표가 있고, 그 목표를 위해 꾸준히 하고 있다." },
];

export const SCALE = ["전혀 아니다", "아니다", "보통이다", "그렇다", "매우 그렇다"];

export type Answers = Record<string, number>; // 1~5

/** 영역별 점수 0~100 */
export function scoreDiagnosis(answers: Answers): Record<Dimension, number> {
  const sums = {} as Record<Dimension, { total: number; n: number }>;
  for (const q of QUESTIONS) {
    const a = answers[q.id];
    if (!a) continue;
    const v = q.reverse ? 6 - a : a; // 1~5
    const s = (sums[q.dimension] ??= { total: 0, n: 0 });
    s.total += v - 1; // 0~4
    s.n += 1;
  }
  const out = {} as Record<Dimension, number>;
  for (const d of Object.keys(DIMENSIONS) as Dimension[]) {
    const s = sums[d];
    out[d] = s ? Math.round((s.total / (s.n * 4)) * 100) : 0;
  }
  return out;
}

/** 보완할 영역: 점수가 낮은 순으로 최대 2개 (70점 미만만) */
export function weakDimensions(scores: Record<Dimension, number>): Dimension[] {
  return (Object.keys(scores) as Dimension[])
    .filter((d) => scores[d] < 70)
    .sort((a, b) => scores[a] - scores[b])
    .slice(0, 2);
}

/** 진단 결과로 추천할 학습법 (중복 없이, 약한 영역 순) */
export function recommendedMethods(scores: Record<Dimension, number>): string[] {
  const ids: string[] = [];
  for (const d of weakDimensions(scores)) for (const m of DIMENSIONS[d].methods) if (!ids.includes(m)) ids.push(m);
  // 모두 괜찮으면 효과가 가장 잘 알려진 방법을 권한다
  return ids.length ? ids : ["retrieval", "spaced", "interleaving"];
}
