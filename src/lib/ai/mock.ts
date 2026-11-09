import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * 키 없이 화면과 흐름을 확인하기 위한 가짜 AI (AI_PROVIDER=mock).
 * 실제 SDK 경로(streamText, Output.object)를 그대로 거치도록 언어 모델 자체를 흉내 낸다.
 */
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function promptText(options: { prompt: unknown }) {
  return JSON.stringify(options.prompt);
}

function jsonFor(text: string): unknown {
  if (text.includes("학습 코치")) {
    return {
      summary: "이번 주는 꾸준히 공부한 날이 많았어요. 집중 시간도 잘 쌓였어요.",
      strengths: ["집중 타이머로 공부한 시간이 늘었어요", "오답을 다시 풀었어요"],
      improvements: ["복습 카드를 넘긴 날이 적었어요"],
      recommendations: [
        { methodId: "spaced", reason: "복습 간격을 지키면 기억이 오래가요" },
        { methodId: "없는학습법", reason: "목록에 없는 추천은 걸러져야 해요" },
      ],
      goals: ["평일 저녁 10분 복습 카드 넘기기", "주말에 백지 복습 1번"],
    };
  }
  if (text.includes("파인만 기법으로") || text.includes("백지 복습으로")) {
    return { score: 72, good: ["핵심 정의를 정확히 썼어요"], missing: ["근의 공식"], misconceptions: [], nextStep: "근의 공식을 유도하는 과정을 다시 설명해 보세요." };
  }
  if (text.includes("검산 선생님")) {
    return { results: [{ index: 0, correct: true, fixedAnswer: "", fixedExplanation: "" }] };
  }
  if (text.includes("[학습 자료]")) {
    return {
      title: "이차방정식 확인 퀴즈",
      questions: [
        {
          type: "multiple",
          prompt: "이차방정식 $x^2 - 5x + 6 = 0$ 의 두 근의 합은?",
          choices: ["1", "5", "6", "-5", "-6"],
          answer: "5",
          explanation: "근과 계수의 관계에서 두 근의 합은 $-\\frac{b}{a} = 5$ 입니다.",
          concept: "근과 계수의 관계",
        },
        {
          type: "short",
          prompt: "$x^2 - 9 = 0$ 의 양수인 근을 쓰시오.",
          choices: [],
          answer: "3",
          explanation: "$x^2 = 9$ 이므로 $x = \\pm 3$, 양수인 근은 3입니다.",
          concept: "제곱근을 이용한 풀이",
        },
        {
          type: "essay",
          prompt: "인수분해를 이용해 이차방정식을 푸는 과정을 설명하시오.",
          choices: [],
          answer: "좌변을 두 일차식의 곱으로 인수분해한 뒤, 곱이 0이면 적어도 하나가 0이라는 성질로 각 일차식을 0으로 놓고 푼다.",
          explanation: "$AB = 0$ 이면 $A = 0$ 또는 $B = 0$ 입니다.",
          concept: "인수분해를 이용한 풀이",
        },
      ],
    };
  }
  return {
    title: "이차방정식의 풀이",
    summary:
      "## 이차방정식이란\n$ax^2 + bx + c = 0\\ (a \\ne 0)$ 꼴의 방정식입니다.\n\n## 푸는 방법\n1. **인수분해**: $(x-2)(x-3)=0 \\Rightarrow x = 2, 3$\n2. **근의 공식**: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$",
    keyPoints: ["$a \\ne 0$ 이어야 이차방정식", "곱이 0이면 적어도 하나는 0", "근의 공식은 모든 이차방정식에 쓸 수 있다"],
  };
}

const TUTOR_HINT = "좋은 질문이에요! 먼저 하나만 생각해 볼까요?\n\n이 식을 **두 일차식의 곱**으로 나타낼 수 있을까요? 곱해서 $6$, 더해서 $-5$가 되는 두 수를 찾아보세요. 🤔";
const TUTOR_SOLUTION = "## 풀이\n1. 곱해서 $6$, 더해서 $-5$인 두 수는 $-2, -3$\n2. $(x-2)(x-3) = 0$\n3. **정답: $x = 2$ 또는 $x = 3$**\n\n확인 문제: $x^2 - 7x + 12 = 0$ 을 풀어보세요.";
const WEB = "## 광합성\n식물이 빛 에너지로 이산화 탄소와 물을 이용해 포도당과 산소를 만드는 과정입니다.\n\n$$6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2$$\n\n## 핵심\n- 엽록체에서 일어난다\n- 빛, 이산화 탄소, 물이 필요하다\n- 산소가 만들어진다";

export function mockModel() {
  return new MockLanguageModelV4({
    doGenerate: async (options) => {
      const text = promptText(options);
      const wantsJson = options.responseFormat?.type === "json";
      return {
        content: [{ type: "text", text: wantsJson ? JSON.stringify(jsonFor(text)) : WEB }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      };
    },
    doStream: async (options) => {
      const text = promptText(options);
      const reply = text.includes("[힌트 모드]") ? TUTOR_HINT : TUTOR_SOLUTION;
      const pieces = reply.match(/[\s\S]{1,12}/g) ?? [reply];
      return {
        stream: simulateReadableStream({
          initialDelayInMs: 100,
          chunkDelayInMs: 20,
          chunks: [
            { type: "text-start", id: "t" },
            ...pieces.map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
            { type: "text-end", id: "t" },
            { type: "finish", finishReason: { unified: "stop", raw: undefined }, logprobs: undefined, usage },
          ],
        }),
      };
    },
  });
}
