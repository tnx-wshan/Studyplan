import { describe, expect, it } from "vitest";
import { gradeAnswer, normalizeAnswer } from "./grade";

describe("gradeAnswer", () => {
  it("multiple choice must match exactly", () => {
    expect(gradeAnswer({ type: "multiple", answer: "5" }, "5")).toBe("correct");
    expect(gradeAnswer({ type: "multiple", answer: "5" }, "6")).toBe("wrong");
  });
  it("short answers ignore spacing, case, punctuation and endings", () => {
    expect(gradeAnswer({ type: "short", answer: "광합성" }, " 광합성. ")).toBe("correct");
    expect(gradeAnswer({ type: "short", answer: "Photosynthesis" }, "photosynthesis")).toBe("correct");
    expect(gradeAnswer({ type: "short", answer: "엽록체" }, "엽록체이다")).toBe("correct");
    expect(gradeAnswer({ type: "short", answer: "３" }, "3")).toBe("correct");
    expect(gradeAnswer({ type: "short", answer: "광합성" }, "호흡")).toBe("wrong");
    expect(gradeAnswer({ type: "short", answer: "광합성" }, "")).toBe("wrong");
  });
  it("accepts multiple answers in any order", () => {
    expect(gradeAnswer({ type: "short", answer: "x = 2, 3" }, "3, x=2")).toBe("correct");
    expect(gradeAnswer({ type: "short", answer: "2, 3" }, "2")).toBe("wrong");
    expect(gradeAnswer({ type: "short", answer: "2, 3" }, "3,2")).toBe("correct");
    expect(gradeAnswer({ type: "short", answer: "2 또는 3" }, "3, 2")).toBe("correct");
  });
  it("essays are self-graded", () => {
    expect(gradeAnswer({ type: "essay", answer: "..." }, "아무거나")).toBe("self");
  });
  it("normalizes LaTeX dollars", () => {
    expect(normalizeAnswer("$x^2$")).toBe("x^2");
  });
});
