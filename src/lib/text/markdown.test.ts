import { describe, expect, it } from "vitest";
import { fixKoreanBold } from "./markdown";

describe("fixKoreanBold", () => {
  it("moves quotes and brackets outside bold so it renders next to Korean letters", () => {
    expect(fixKoreanBold("자주 나오는 **'광합성과 호흡의 차이'**에 대해")).toBe("자주 나오는 '**광합성과 호흡의 차이**'에 대해");
    expect(fixKoreanBold("필요한 **에너지 (ATP)**를 얻는")).toBe("필요한 **에너지 (ATP**)를 얻는");
    expect(fixKoreanBold("**(가)**와 **정답: 3.**")).toBe("(**가**)와 **정답: 3**.");
  });
  it("leaves ordinary bold and math alone", () => {
    expect(fixKoreanBold("이 식을 **두 일차식의 곱**으로")).toBe("이 식을 **두 일차식의 곱**으로");
    expect(fixKoreanBold("$a ** b$ 그리고 **x**")).toBe("$a ** b$ 그리고 **x**");
    expect(fixKoreanBold("별표 없음")).toBe("별표 없음");
  });
});
