import { coursesFor, type GradeId, type SubjectGroup } from "@/data/curriculum";
import type { Step } from "@/lib/learn/types";

/**
 * 학습 탭 예제 데이터. 서버 DB를 처음 만들 때 한 번 넣는다 (src/lib/server/learn.ts).
 * 대량의 유닛은 나중에 관리 도구(자료 모음 → AI로 유닛 만들기)나 일괄 입력으로 채운다.
 *
 * 섹션은 교육과정의 대표 단원(목차)을 그대로 쓴다. 유닛이 없는 섹션은 '준비 중'으로 보인다.
 */
export interface SampleUnit {
  section: string;
  title: string;
  steps: Step[];
}

export interface SampleCourse {
  grade: GradeId;
  subject: SubjectGroup;
  sections: string[];
  units: SampleUnit[];
}

const M1_MATH_SECTIONS = coursesFor("m1", "math")[0]?.units ?? [];

export const SAMPLE_COURSES: SampleCourse[] = [
  {
    grade: "m1",
    subject: "math",
    sections: M1_MATH_SECTIONS,
    units: [
      {
        section: "소인수분해",
        title: "소수와 합성수",
        steps: [
          {
            type: "summary",
            title: "소수와 합성수",
            body: "- **소수**: 1보다 큰 자연수 중에서 1과 자기 자신만을 약수로 가지는 수 (예: $2, 3, 5, 7$)\n- **합성수**: 1보다 큰 자연수 중에서 소수가 아닌 수. 약수가 3개 이상이에요 (예: $4, 6, 9$)\n- **1**은 약수가 1개뿐이라 소수도 합성수도 아니에요.",
            points: ["$2$는 짝수인 유일한 소수", "1은 소수도 합성수도 아니다"],
          },
          { type: "choice", prompt: "다음 중 **소수**인 것은?", choices: ["9", "15", "17", "21"], answer: "17", explanation: "17의 약수는 1과 17뿐이에요. 9 = 3×3, 15 = 3×5, 21 = 3×7은 합성수예요." },
          {
            type: "blank",
            prompt: "빈칸에 알맞은 말을 고르세요.",
            text: "1보다 큰 자연수 중 1과 자기 자신만을 약수로 가지는 수를 [[소수]]라 하고, 소수가 아닌 수를 [[합성수]]라고 한다.",
            distractors: ["약수", "배수"],
            explanation: "약수가 2개인 수는 소수, 3개 이상인 수는 합성수예요.",
          },
          { type: "short", prompt: "1부터 20까지의 자연수 중 **소수는 몇 개**인가요?", answers: ["8", "8개"], explanation: "2, 3, 5, 7, 11, 13, 17, 19 → 모두 8개예요.", math: true },
          { type: "puzzle", prompt: "약수가 3개 이상인 자연수", answer: "합성수", decoys: "소약", explanation: "1보다 큰 자연수 중 소수가 아닌 수를 합성수라고 해요." },
          { type: "choice", prompt: "**1**에 대한 설명으로 옳은 것은?", choices: ["소수이다", "합성수이다", "소수도 합성수도 아니다"], answer: "소수도 합성수도 아니다", explanation: "1의 약수는 1 하나뿐이라 소수의 조건(약수 2개)을 만족하지 않아요." },
        ],
      },
      {
        section: "소인수분해",
        title: "거듭제곱과 소인수분해",
        steps: [
          {
            type: "summary",
            title: "거듭제곱",
            body: "같은 수를 여러 번 곱한 것을 **거듭제곱**으로 나타내요.\n\n$$2 \\times 2 \\times 2 = 2^3$$\n\n곱한 수 $2$를 **밑**, 곱한 횟수 $3$을 **지수**라고 해요.",
            points: ["밑: 곱하는 수", "지수: 곱한 횟수"],
          },
          {
            type: "summary",
            title: "소인수분해",
            body: "자연수를 **소인수(소수인 인수)들만의 곱**으로 나타내는 것을 소인수분해라고 해요.\n\n$$12 = 2 \\times 2 \\times 3 = 2^2 \\times 3$$\n\n작은 소수부터 차례로 나누면 쉽게 할 수 있어요.",
            points: ["같은 소인수는 거듭제곱으로 쓴다", "작은 소인수부터 차례로 쓴다"],
          },
          { type: "choice", prompt: "$3^4$에서 **밑**은?", choices: ["3", "4", "12", "81"], answer: "3", explanation: "$3^4 = 3 \\times 3 \\times 3 \\times 3$ 이므로 밑은 3, 지수는 4예요." },
          {
            type: "short",
            prompt: "$2 \\times 2 \\times 2 \\times 5 \\times 5$를 거듭제곱을 써서 나타내세요.",
            answers: ["2^3×5^2", "5^2×2^3"],
            explanation: "2가 3번, 5가 2번 곱해졌으므로 $2^3 \\times 5^2$ 예요.",
            math: true,
          },
          { type: "blank", prompt: "빈칸에 알맞은 말을 고르세요.", text: "$2^5$에서 2를 [[밑]], 5를 [[지수]]라고 한다.", distractors: ["인수", "약수"], explanation: "곱하는 수가 밑, 곱한 횟수가 지수예요." },
          { type: "short", prompt: "$60$을 소인수분해 하세요.", answers: ["2^2×3×5"], explanation: "$60 = 2 \\times 30 = 2 \\times 2 \\times 15 = 2^2 \\times 3 \\times 5$", math: true },
          { type: "puzzle", prompt: "자연수를 소인수들만의 곱으로 나타내는 것", answer: "소인수분해", decoys: "약배", explanation: "예: $18 = 2 \\times 3^2$" },
        ],
      },
      {
        section: "정수와 유리수",
        title: "정수와 유리수의 뜻",
        steps: [
          {
            type: "summary",
            title: "정수와 유리수",
            body: "- **정수**: 양의 정수($+1, +2, \\dots$), $0$, 음의 정수($-1, -2, \\dots$)\n- **유리수**: 분자, 분모가 정수인 분수 $\\dfrac{a}{b}$ $(b \\ne 0)$ 꼴로 나타낼 수 있는 수\n- 정수도 $3 = \\dfrac{3}{1}$ 처럼 쓸 수 있으니 유리수예요.",
            points: ["0은 양수도 음수도 아니다", "모든 정수는 유리수"],
          },
          { type: "choice", prompt: "다음 중 **정수가 아닌** 것은?", choices: ["$-3$", "$0$", "$\\frac{2}{3}$", "$5$"], answer: "$\\frac{2}{3}$", explanation: "$\\frac{2}{3}$은 정수가 아닌 유리수예요." },
          { type: "blank", prompt: "빈칸에 알맞은 말을 고르세요.", text: "양의 정수, 0, 음의 정수를 통틀어 [[정수]]라고 한다.", distractors: ["유리수", "자연수"], explanation: "양의 정수(자연수), 0, 음의 정수를 모두 합쳐 정수라고 해요." },
          { type: "short", prompt: "$-\\dfrac{6}{3}$은 어떤 정수와 같나요?", answers: ["-2"], explanation: "$6 \\div 3 = 2$ 이므로 $-\\dfrac{6}{3} = -2$ 예요.", math: true },
          { type: "puzzle", prompt: "분자와 분모가 정수인 분수로 나타낼 수 있는 수 (분모는 0이 아님)", answer: "유리수", decoys: "정자", explanation: "정수도 분모가 1인 분수로 쓸 수 있어서 유리수예요." },
          { type: "choice", prompt: "절댓값이 3인 수를 모두 고른 것은?", choices: ["3", "-3", "3과 -3", "0"], answer: "3과 -3", explanation: "수직선에서 0으로부터 거리가 3인 수는 $3$과 $-3$ 두 개예요." },
        ],
      },
    ],
  },
];
