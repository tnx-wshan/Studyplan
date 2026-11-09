import { describe, expect, it } from "vitest";
import { withEulReul, withRo } from "./korean";

describe("korean particles", () => {
  it("picks 을/를 by final consonant", () => {
    expect(withEulReul("떠올리며 공부")).toBe("떠올리며 공부를");
    expect(withEulReul("복습 습관")).toBe("복습 습관을");
  });
  it("picks 로/으로 with the ㄹ exception", () => {
    expect(withRo("아기")).toBe("아기로");
    expect(withRo("청소년")).toBe("청소년으로");
    expect(withRo("어른")).toBe("어른으로");
    expect(withRo("물")).toBe("물로");
  });
});
