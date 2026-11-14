import { describe, expect, it } from "vitest";
import { cleanAiText, repairLatexEscapes } from "./text";
import { fixNewlines } from "./service";

describe("cleanAiText", () => {
  it("글자 그대로 온 \\n을 줄바꿈으로 바꾼다", () => {
    expect(cleanAiText("1. 힘\\n- 단위: N\\n\\n### 2. 무게")).toBe("1. 힘\n- 단위: N\n\n### 2. 무게");
  });

  it("\\neq, \\nu 같은 수식 명령은 건드리지 않는다", () => {
    expect(cleanAiText("$a \\neq b$ 그리고 $\\nu$")).toBe("$a \\neq b$ 그리고 $\\nu$");
  });

  it("$ 없이 온 수식을 감싼다", () => {
    expect(cleanAiText("2^2 \\times 3")).toBe("$2^2 \\times 3$");
    expect(cleanAiText("2^3 \\times 3^3 \\times 5 입니다")).toBe("$2^3 \\times 3^3 \\times 5$ 입니다");
  });

  it("$ 없는 거듭제곱도 감싼다", () => {
    expect(cleanAiText("거듭제곱 5^4에서 밑의 값을 구하시오.")).toBe("거듭제곱 $5^4$에서 밑의 값을 구하시오.");
    expect(cleanAiText("자연수 180을 소인수분해하면 2^2 \\times 3^2 \\times 5이다.")).toBe("자연수 180을 소인수분해하면 $2^2 \\times 3^2 \\times 5$이다.");
  });

  it("이미 $가 있거나 수식 명령이 없으면 그대로 둔다", () => {
    expect(cleanAiText("값은 $2 \\times 3$ 이다")).toBe("값은 $2 \\times 3$ 이다");
    expect(cleanAiText("평범한 문장")).toBe("평범한 문장");
  });
});

describe("repairLatexEscapes", () => {
  // JS 문자열의 "\t", "\f", "\b", "\r", "\n"은 모델이 JSON에 백슬래시를 하나만 썼을 때 생기는 제어 문자와 같다
  it("탭·폼피드·백스페이스·CR이 된 수식 명령을 되돌린다", () => {
    expect("$2^2 \times 3$").toContain("\t");
    expect(repairLatexEscapes("$12 = 2^2 \times 3$")).toBe(String.raw`$12 = 2^2 \times 3$`);
    expect(repairLatexEscapes("$\frac{1}{2}$, $\beta$, $a \rightarrow b$")).toBe(String.raw`$\frac{1}{2}$, $\beta$, $a \rightarrow b$`);
  });

  it("수식 안의 \\neq·\\nabla만 되돌리고 진짜 줄바꿈은 둔다", () => {
    expect(repairLatexEscapes("$a \neq b$, $\nabla f$")).toBe(String.raw`$a \neq b$, $\nabla f$`);
    expect(repairLatexEscapes("첫 줄\nis 영어 줄")).toBe("첫 줄\nis 영어 줄");
    expect(repairLatexEscapes("$x$\nequal")).toBe("$x$\nequal");
    expect(repairLatexEscapes("이름\t점수")).toBe("이름\t점수");
  });

  it("화면 정리(cleanAiText)와 서버의 AI 응답 정리(fixNewlines)에 모두 적용된다", () => {
    const broken = "자연수 12를 소인수분해하면 $12 = 2^2 \times 3$이다.";
    expect(cleanAiText(broken)).toBe(String.raw`자연수 12를 소인수분해하면 $12 = 2^2 \times 3$이다.`);
    expect(fixNewlines(broken)).toBe(String.raw`자연수 12를 소인수분해하면 $12 = 2^2 \times 3$이다.`);
  });
});

describe("repairLatexEscapes ($$ 수식)", () => {
  it("따로 한 줄 수식 안의 \\neq도 되돌린다", () => {
    expect(repairLatexEscapes("$$a \neq b$$ 다음\n줄")).toBe(String.raw`$$a \neq b$$ 다음` + "\n줄");
  });
});

describe("stripImages", () => {
  it("그림을 [그림] 표시로 바꾼다", async () => {
    const { stripImages } = await import("./text");
    expect(stripImages("다음 그림을 보고\n\n![문제 그림](/api/media?id=1) 답하시오")).toBe("다음 그림을 보고\n\n[그림: 문제 그림] 답하시오");
    expect(stripImages("![](/x)")).toBe("[그림]");
  });
});

describe("normalizeMathDelimiters", () => {
  it("\\( \\)는 $로, \\[ \\]는 $$로 바꾼다", async () => {
    const { normalizeMathDelimiters, cleanAiText } = await import("./text");
    expect(normalizeMathDelimiters(String.raw`값은 \( 3^4 \)이고 \[x = 2\] 이다`)).toBe("값은 $3^4$이고 $$x = 2$$ 이다");
    expect(normalizeMathDelimiters("빈칸 [[소수]]는 그대로")).toBe("빈칸 [[소수]]는 그대로");
    expect(cleanAiText(String.raw`\(2^3\)의 값`)).toBe("$2^3$의 값");
  });
});
