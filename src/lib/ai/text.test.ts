import { describe, expect, it } from "vitest";
import { cleanAiText } from "./text";

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

  it("이미 $가 있거나 수식 명령이 없으면 그대로 둔다", () => {
    expect(cleanAiText("값은 $2 \\times 3$ 이다")).toBe("값은 $2 \\times 3$ 이다");
    expect(cleanAiText("평범한 문장")).toBe("평범한 문장");
  });
});
