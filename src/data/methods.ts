import type { SubjectGroup } from "./curriculum";

/**
 * 학습법 라이브러리.
 * 효과 근거는 학습과학 연구(인출 연습, 간격 반복, 교차 학습, 정교화 등)를 바탕으로
 * '높음 / 보통' 두 단계로만 표시한다. 학습 유형(시각형·청각형) 이론처럼 근거가 약한 내용은 넣지 않는다.
 */
export type PracticeKind = "blank" | "feynman" | "cornell" | "guided";

export interface StudyMethod {
  id: string;
  name: string;
  icon: string;
  oneLine: string;
  description: string;
  /** 왜 효과가 있는지 */
  why: string;
  evidence: "high" | "medium";
  steps: string[];
  tips: string[];
  /** 잘 맞는 과목 (비어 있으면 모든 과목) */
  subjects: SubjectGroup[];
  minutes: number;
  practice: PracticeKind;
  /** 앱 안에서 바로 해볼 수 있는 기능 */
  links?: { href: string; label: string }[];
}

export const METHODS: StudyMethod[] = [
  {
    id: "retrieval",
    name: "인출 연습 (떠올리기)",
    icon: "🧠",
    oneLine: "다시 읽지 말고, 책을 덮고 떠올려 보기",
    description: "배운 내용을 보지 않고 머릿속에서 꺼내 보는 공부법이에요. 플래시카드, 스스로 문제 내기, 퀴즈 풀기가 모두 인출 연습이에요.",
    why: "기억은 꺼낼 때 더 단단해져요. 같은 시간 동안 다시 읽기보다 떠올리기를 한 학생이 시험에서 더 많이 기억한다는 연구가 많아요.",
    evidence: "high",
    steps: ["공부할 범위를 정하고 한 번 읽어요.", "책을 덮고 기억나는 것을 말하거나 써 봐요.", "책을 다시 펴서 빠진 것과 틀린 것을 확인해요.", "빠진 부분만 다시 보고, 다시 떠올려 봐요."],
    tips: ["잘 안 떠오르는 게 정상이에요. 그 '애쓰는 느낌'이 기억을 만들어요.", "읽고 바로 하는 것보다 조금 시간이 지난 뒤에 하면 더 좋아요."],
    subjects: [],
    minutes: 15,
    practice: "guided",
    links: [
      { href: "/review/cards", label: "플래시카드로 떠올리기" },
      { href: "/ai/create", label: "AI 퀴즈로 떠올리기" },
    ],
  },
  {
    id: "blank",
    name: "백지 복습",
    icon: "📄",
    oneLine: "빈 종이에 아는 것을 모두 써 보기",
    description: "단원 이름만 보고 빈 종이에 기억나는 개념, 공식, 흐름을 모두 써 보는 방법이에요. 다 쓴 뒤 교과서와 비교해 빠진 것을 채워요.",
    why: "인출 연습의 한 가지예요. 내가 아는 것과 모르는 것이 한눈에 드러나서, 모르는 부분만 골라 공부할 수 있어요.",
    evidence: "high",
    steps: ["단원 이름을 맨 위에 써요.", "10분 동안 기억나는 것을 모두 써요 (그림, 화살표도 좋아요).", "교과서나 정리 자료와 비교해요.", "빠진 것은 다른 색으로 채우고, 그 부분을 다시 공부해요."],
    tips: ["처음엔 거의 못 써도 괜찮아요. 두 번째에는 훨씬 많이 써져요.", "시험 1주일 전부터 단원마다 해 보세요."],
    subjects: [],
    minutes: 15,
    practice: "blank",
  },
  {
    id: "spaced",
    name: "간격 반복",
    icon: "📅",
    oneLine: "잊어버릴 때쯤 다시 보기",
    description: "한 번에 몰아서 하지 않고 1일, 3일, 7일, 14일처럼 간격을 두고 여러 번 복습하는 방법이에요.",
    why: "사람은 배운 것을 빠르게 잊지만(망각 곡선), 잊어버릴 때쯤 다시 보면 기억이 오래가요. 벼락치기보다 같은 시간을 나눠서 공부하는 게 훨씬 오래 남아요.",
    evidence: "high",
    steps: ["오늘 배운 것을 짧게 복습해요.", "1일, 3일, 7일, 14일 뒤에 다시 복습해요.", "복습할 때는 다시 읽기보다 떠올리기로 해요."],
    tips: ["홈스터디는 단원 공부를 끝내면 복습 일정을 자동으로 만들어 줘요.", "플래시카드는 기억 정도에 맞춰 간격이 저절로 조절돼요."],
    subjects: [],
    minutes: 10,
    practice: "guided",
    links: [
      { href: "/review", label: "오늘의 복습 보기" },
      { href: "/review/cards", label: "플래시카드" },
    ],
  },
  {
    id: "interleaving",
    name: "교차 학습",
    icon: "🔀",
    oneLine: "한 가지만 계속하지 말고 섞어서 풀기",
    description: "같은 유형 문제를 몰아서 풀지 않고, 여러 유형이나 과목을 섞어서 공부하는 방법이에요.",
    why: "섞어서 풀면 '이 문제에 어떤 방법을 써야 하지?'를 매번 고민하게 돼요. 처음엔 더 어렵게 느껴지지만 시험에서 문제 유형을 알아보는 힘이 커져요. 특히 수학에서 효과가 잘 알려져 있어요.",
    evidence: "high",
    steps: ["오늘 풀 문제를 2~3개 유형(단원)에서 골라요.", "유형을 섞어서 순서대로 풀어요.", "풀기 전에 '어떤 개념을 쓰는 문제인지' 먼저 말해 봐요."],
    tips: ["처음 배우는 단원은 먼저 한 유형을 익히고 나서 섞어요.", "시험 계획을 만들면 과목이 자동으로 번갈아 배치돼요."],
    subjects: ["math", "science"],
    minutes: 30,
    practice: "guided",
    links: [{ href: "/planner/exam/new", label: "교차 학습 시험 계획 만들기" }],
  },
  {
    id: "feynman",
    name: "파인만 기법",
    icon: "🗣️",
    oneLine: "초등학생에게 설명하듯 쉽게 말해 보기",
    description: "개념을 어려운 용어 없이 쉬운 말로 설명해 보는 방법이에요. 설명이 막히는 곳이 바로 내가 제대로 모르는 곳이에요.",
    why: "설명하려면 개념끼리 연결하고 '왜'를 생각해야 해요(정교화, 자기 설명). 그러면서 이해가 깊어지고 모르는 부분이 드러나요.",
    evidence: "medium",
    steps: ["설명할 개념 하나를 정해요.", "동생이나 친구에게 가르치듯 쉬운 말로 써요.", "막히거나 어려운 용어를 그대로 쓴 곳을 찾아요.", "그 부분을 다시 공부하고 더 쉽게 고쳐 써요."],
    tips: ["비유나 예시를 하나 꼭 넣어 보세요.", "AI에게 설명을 보여주고 빠진 점을 물어볼 수 있어요."],
    subjects: [],
    minutes: 15,
    practice: "feynman",
  },
  {
    id: "selfExplain",
    name: "자기 설명",
    icon: "💬",
    oneLine: "풀이 한 줄마다 '왜?'를 말해 보기",
    description: "문제 풀이나 예제를 볼 때 각 단계가 왜 그렇게 되는지 스스로 설명하는 방법이에요.",
    why: "풀이를 그냥 따라 읽는 것보다, 단계마다 이유를 말한 학생이 새 문제를 더 잘 풀어요. 내가 이해했다고 착각하는 부분을 찾아줘요.",
    evidence: "medium",
    steps: ["예제나 내 풀이를 한 줄씩 봐요.", "줄마다 '이렇게 한 이유는…'이라고 말하거나 옆에 써요.", "이유를 모르는 줄에 표시하고 개념을 다시 확인해요."],
    tips: ["소리 내서 말하면 더 효과가 좋아요.", "틀린 문제 풀이에 하면 오답 분석이 돼요."],
    subjects: ["math", "science"],
    minutes: 15,
    practice: "guided",
  },
  {
    id: "errorAnalysis",
    name: "오답 분석",
    icon: "🔍",
    oneLine: "틀린 이유를 찾고 같은 실수를 막기",
    description: "틀린 문제를 그냥 정답만 확인하고 넘어가지 않고, 왜 틀렸는지(개념, 실수, 시간) 나누어 기록하고 다시 푸는 방법이에요.",
    why: "틀린 문제에는 내 약점이 그대로 담겨 있어요. 틀린 이유를 알고 간격을 두고 다시 풀면 같은 유형에서 덜 틀려요.",
    evidence: "medium",
    steps: ["틀린 문제를 오답노트에 기록해요.", "틀린 이유를 고르고, 한 줄로 원인을 써요.", "정답을 보지 않고 다시 풀어 봐요.", "1·3·7일 뒤에 다시 풀어서 3번 연속 맞히면 정복!"],
    tips: ["'실수'가 많다면 나만의 확인 규칙을 만들어요 (예: 부호 다시 보기).", "'개념 부족'이 많다면 그 단원을 백지 복습해요."],
    subjects: [],
    minutes: 15,
    practice: "guided",
    links: [
      { href: "/review/wrong/new", label: "오답 기록하기" },
      { href: "/review/wrong", label: "오답노트" },
    ],
  },
  {
    id: "cornell",
    name: "코넬 노트",
    icon: "📝",
    oneLine: "필기를 질문·내용·요약 세 칸으로",
    description: "노트를 키워드(질문) 칸, 필기 칸, 요약 칸으로 나누어 정리하는 방법이에요. 복습할 때 필기 칸을 가리고 키워드만 보며 떠올려요.",
    why: "정리하면서 핵심을 질문으로 바꾸고 요약하게 돼요. 복습할 때 자연스럽게 인출 연습을 할 수 있어요.",
    evidence: "medium",
    steps: ["필기 칸에 수업 내용을 적어요.", "수업이 끝나면 왼쪽 칸에 핵심 키워드나 질문을 써요.", "아래 칸에 2~3문장으로 요약해요.", "복습할 때 필기 칸을 가리고 질문에 답해 봐요."],
    tips: ["필기는 짧게, 질문은 '왜/어떻게'로 써 보세요.", "요약은 교과서를 보지 않고 써요."],
    subjects: ["korean", "social", "science"],
    minutes: 20,
    practice: "cornell",
  },
  {
    id: "mindmap",
    name: "개념 지도",
    icon: "🗺️",
    oneLine: "개념들을 선으로 이어 한 장에 그리기",
    description: "가운데에 단원 주제를 쓰고, 관련 개념을 가지처럼 이어서 관계를 한 장에 그리는 방법이에요.",
    why: "개념 사이의 관계(원인과 결과, 포함 관계)를 생각하게 돼요. 기억해서 그리면 인출 연습도 함께 돼요.",
    evidence: "medium",
    steps: ["가운데에 단원 주제를 써요.", "큰 개념 3~5개를 가지로 이어요.", "각 개념에 세부 내용과 예시를 붙여요.", "가지 사이에 관계가 있으면 화살표와 설명을 써요."],
    tips: ["교과서를 보고 따라 그리기보다, 먼저 기억해서 그린 뒤 비교하세요.", "사회·과학처럼 개념이 많은 과목에 좋아요."],
    subjects: ["social", "science", "korean"],
    minutes: 20,
    practice: "guided",
  },
  {
    id: "dualCoding",
    name: "그림과 글 함께",
    icon: "🎨",
    oneLine: "설명을 그림, 표, 도식으로도 나타내기",
    description: "글로 된 내용을 그림, 그래프, 표, 순서도로 바꾸어 함께 공부하는 방법이에요(이중 부호화).",
    why: "같은 내용을 말과 그림 두 가지로 기억하면 떠올릴 단서가 많아져요. 과정이나 구조를 이해할 때 특히 좋아요.",
    evidence: "medium",
    steps: ["교과서의 그림이나 표를 설명과 연결해서 봐요.", "글로 된 과정을 직접 순서도나 그림으로 그려요.", "그림만 보고 설명을 다시 말해 봐요."],
    tips: ["예쁘게 그릴 필요 없어요. 화살표와 상자면 충분해요.", "과학 실험 과정, 역사 사건 흐름에 써 보세요."],
    subjects: ["science", "social"],
    minutes: 15,
    practice: "guided",
  },
  {
    id: "examples",
    name: "나만의 예시 만들기",
    icon: "🧩",
    oneLine: "개념마다 내 생활 속 예를 찾아보기",
    description: "추상적인 개념을 내 경험이나 주변의 구체적인 예와 연결하는 방법이에요.",
    why: "구체적인 예가 있으면 개념을 이해하고 기억하기 쉬워져요. 여러 예를 비교하면 개념의 핵심이 보여요.",
    evidence: "medium",
    steps: ["개념의 정의를 읽어요.", "교과서 예시 말고 나만의 예를 2개 만들어요.", "왜 그 예가 개념에 맞는지 한 줄로 설명해요."],
    tips: ["'이건 예가 아니다'인 경우도 하나 생각해 보면 더 확실해져요."],
    subjects: ["social", "science", "english"],
    minutes: 10,
    practice: "guided",
  },
  {
    id: "elaboration",
    name: "왜? 질문하기",
    icon: "❓",
    oneLine: "사실마다 '왜 그럴까?'를 물어보기",
    description: "외워야 하는 사실에 '왜 그럴까?', '어떻게 연결될까?'를 묻고 답을 찾아보는 방법이에요(정교화 질문).",
    why: "이유를 알면 따로따로 외울 때보다 오래 기억해요. 이미 아는 것과 새 내용을 연결해 줘요.",
    evidence: "medium",
    steps: ["외울 사실을 하나 골라요.", "'왜 그럴까?'를 묻고 내가 아는 것으로 답해 봐요.", "교과서나 자료로 답을 확인해요."],
    tips: ["역사 사건의 원인, 과학 현상의 이유에 잘 맞아요."],
    subjects: ["social", "science"],
    minutes: 10,
    practice: "guided",
  },
  {
    id: "sq3r",
    name: "SQ3R 읽기",
    icon: "📖",
    oneLine: "훑기→질문→읽기→말하기→복습",
    description: "긴 글을 읽을 때 먼저 훑어보고(Survey), 질문을 만들고(Question), 읽고(Read), 떠올려 말하고(Recite), 복습하는(Review) 방법이에요.",
    why: "질문을 가지고 읽으면 중요한 내용에 집중하게 되고, 말하기 단계에서 인출 연습이 돼요.",
    evidence: "medium",
    steps: ["제목, 소제목, 그림, 굵은 글씨를 1분 동안 훑어요.", "소제목을 질문으로 바꿔요 (예: '광합성이란?' → '광합성은 왜 필요할까?').", "질문의 답을 찾으며 읽어요.", "책을 덮고 질문에 답해 봐요.", "마지막에 전체 흐름을 한 번 정리해요."],
    tips: ["국어 비문학, 사회·과학 교과서 읽기에 좋아요."],
    subjects: ["korean", "social", "science", "english"],
    minutes: 25,
    practice: "guided",
  },
  {
    id: "pomodoro",
    name: "뽀모도로",
    icon: "🍅",
    oneLine: "25분 집중, 5분 휴식",
    description: "타이머로 25분 집중하고 5분 쉬기를 반복하는 시간 관리 방법이에요.",
    why: "끝나는 시간이 정해져 있으면 시작하기 쉽고, 짧게 쉬면서 집중력을 다시 채울 수 있어요. 휴대폰을 멀리 두면 효과가 더 커요.",
    evidence: "medium",
    steps: ["할 일 하나를 정해요.", "25분 타이머를 켜고 그 일만 해요.", "5분 쉬어요 (휴대폰 대신 스트레칭이나 물 마시기).", "4번 하면 15~30분 길게 쉬어요."],
    tips: ["집중이 잘 되면 50분/10분으로 늘려도 좋아요.", "공부하는 동안 휴대폰은 다른 방에 두세요."],
    subjects: [],
    minutes: 25,
    practice: "guided",
    links: [{ href: "/timer", label: "집중 타이머 켜기" }],
  },
  {
    id: "smallPlan",
    name: "작게 쪼개고 '언제·어디서' 정하기",
    icon: "🎯",
    oneLine: "'수학 공부'가 아니라 '저녁 8시 책상에서 30~35쪽'",
    description: "큰 목표를 30분 안에 끝낼 수 있는 작은 일로 쪼개고, 언제 어디서 할지까지 정해 두는 방법이에요(실행 계획).",
    why: "'언제, 어디서, 무엇을'까지 정한 계획은 막연한 다짐보다 실제로 실천할 가능성이 훨씬 높다는 연구가 있어요.",
    evidence: "high",
    steps: ["이번 주 목표를 하나 정해요.", "30분 안에 끝낼 수 있는 일로 쪼개요.", "'○시에 ○○에서 ○○를 한다'로 써요.", "못 했으면 탓하지 말고 다음 날로 옮겨요."],
    tips: ["'만약 ~하면 ~한다' 규칙도 좋아요 (예: 학원에서 돌아오면 바로 단어 10개).", "플래너에서 할 일마다 예상 시간을 정해 보세요."],
    subjects: [],
    minutes: 10,
    practice: "guided",
    links: [{ href: "/planner", label: "플래너에서 계획 세우기" }],
  },
];

export function methodById(id: string): StudyMethod | undefined {
  return METHODS.find((m) => m.id === id);
}

export interface Situation {
  id: string;
  icon: string;
  label: string;
  advice: string;
  /** 추천 순서대로 */
  methods: string[];
}

export const SITUATIONS: Situation[] = [
  { id: "exam3", icon: "⏰", label: "시험이 3일 남았어요", advice: "새로 읽기보다 떠올리기와 틀린 문제에 시간을 쓰세요.", methods: ["blank", "retrieval", "errorAnalysis", "spaced"] },
  { id: "notUnderstand", icon: "🤯", label: "개념이 이해가 안 돼요", advice: "쉬운 말로 설명해 보고, 예시와 그림으로 연결해 보세요.", methods: ["feynman", "examples", "dualCoding", "selfExplain"] },
  { id: "memorize", icon: "📚", label: "외울 게 너무 많아요", advice: "한 번에 몰아서 외우지 말고 나눠서 여러 번 떠올리세요.", methods: ["retrieval", "spaced", "elaboration", "mindmap"] },
  { id: "keepWrong", icon: "❌", label: "문제를 풀면 자꾸 틀려요", advice: "틀린 이유를 나누어 보고, 풀이 단계마다 이유를 말해 보세요.", methods: ["errorAnalysis", "selfExplain", "interleaving"] },
  { id: "cantFocus", icon: "😵", label: "집중이 안 돼요", advice: "짧게 끊어서 집중하고, 휴대폰을 멀리 두세요.", methods: ["pomodoro", "smallPlan"] },
  { id: "planFails", icon: "🗓️", label: "계획이 자꾸 밀려요", advice: "계획을 더 작게 쪼개고 언제·어디서 할지 정하세요.", methods: ["smallPlan", "pomodoro", "spaced"] },
  { id: "afterClass", icon: "🏫", label: "수업 내용을 정리하고 싶어요", advice: "정리하면서 질문을 만들고, 나중에 질문으로 떠올리세요.", methods: ["cornell", "blank", "mindmap"] },
  { id: "longReading", icon: "📰", label: "긴 글 읽기가 힘들어요", advice: "먼저 훑어보고 질문을 만든 뒤 답을 찾으며 읽으세요.", methods: ["sq3r", "mindmap", "elaboration"] },
  { id: "mathProblems", icon: "➗", label: "수학 문제 풀이를 잘하고 싶어요", advice: "유형을 섞어서 풀고, 풀이마다 이유를 말해 보세요.", methods: ["interleaving", "selfExplain", "errorAnalysis", "retrieval"] },
];

/** 과목이 맞는 학습법을 앞으로 (순서는 유지) */
export function sortForSubject(ids: string[], group?: SubjectGroup): StudyMethod[] {
  const list = ids.map(methodById).filter((m): m is StudyMethod => !!m);
  if (!group) return list;
  const fits = (m: StudyMethod) => m.subjects.length === 0 || m.subjects.includes(group);
  return [...list.filter(fits), ...list.filter((m) => !fits(m))];
}
