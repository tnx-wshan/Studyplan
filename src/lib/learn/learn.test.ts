import { describe, expect, it } from "vitest";
import { SAMPLE_COURSES } from "@/data/learn/samples";
import { blankAnswers, estimateMinutes, gradeStep, letters, matchesAnswer, normalizeAnswer, numericValue, parseBlanks, puzzleTiles, sanitizeStep, sanitizeSteps } from "./check";
import { advance, cappedSeconds, currentStep, isFinished, lessonScore, lessonXp, nextUnitId, recordResult, startLesson, unitStates } from "./engine";
import { toLatex } from "./latex";
import type { Step } from "./types";

describe("answer normalizing", () => {
  it("treats spacing, symbols and superscripts the same", () => {
    expect(normalizeAnswer(" 2^3 × 5^2 ")).toBe(normalizeAnswer("2³*5²"));
    expect(normalizeAnswer("x²")).toBe("x^2");
    expect(normalizeAnswer("x¹⁰")).toBe("x^10");
    expect(normalizeAnswer("√2")).toBe(normalizeAnswer("sqrt(2)"));
    expect(normalizeAnswer("$\\frac{3}{4}$")).toBe("3/4");
    expect(normalizeAnswer("이산화 탄소.")).toBe("이산화탄소");
    expect(normalizeAnswer("−3")).toBe("-3");
  });

  it("compares simple numbers by value", () => {
    expect(numericValue("0.5")).toBe(0.5);
    expect(numericValue("-3/4")).toBe(-0.75);
    expect(numericValue("x")).toBeNull();
    expect(matchesAnswer("1/2", ["0.5"])).toBe(true);
    expect(matchesAnswer("-2", ["-6/3"])).toBe(true);
    expect(matchesAnswer("2", ["3"])).toBe(false);
    expect(matchesAnswer("", ["3"])).toBe(false);
    expect(matchesAnswer("8개", ["8", "8개"])).toBe(true);
  });
});

describe("blanks and puzzles", () => {
  it("parses [[blanks]]", () => {
    const parts = parseBlanks("A는 [[소수]], B는 [[합성수]]다.");
    expect(parts.map((p) => p.kind)).toEqual(["text", "blank", "text", "blank", "text"]);
    expect(blankAnswers({ text: "A는 [[소수]], B는 [[합성수]]다." })).toEqual(["소수", "합성수"]);
  });

  it("makes tiles from answer letters and decoys", () => {
    const tiles = puzzleTiles({ answer: "합성수", decoys: "소약" }, () => 0.5);
    expect([...tiles].sort()).toEqual(["소", "수", "성", "약", "합"].sort());
    expect(letters("소인수 분해")).toEqual(["소", "인", "수", "분", "해"]);
  });

  it("grades every question type", () => {
    expect(gradeStep({ type: "choice", prompt: "", choices: ["a", "b"], answer: "b", explanation: "" }, "b")).toBe(true);
    expect(gradeStep({ type: "short", prompt: "", answers: ["2^2×3×5"], explanation: "" }, "2²*3*5")).toBe(true);
    expect(gradeStep({ type: "blank", prompt: "", text: "[[밑]]과 [[지수]]", distractors: [], explanation: "" }, ["밑", "지수"])).toBe(true);
    expect(gradeStep({ type: "blank", prompt: "", text: "[[밑]]과 [[지수]]", distractors: [], explanation: "" }, ["지수", "밑"])).toBe(false);
    expect(gradeStep({ type: "puzzle", prompt: "", answer: "합성수", decoys: "", explanation: "" }, "합성수")).toBe(true);
  });
});

describe("step checking", () => {
  it("drops broken steps with a reason", () => {
    expect(sanitizeStep({ type: "choice", prompt: "q", choices: ["a", "b"], answer: "c" }).problem).toMatch(/보기에 없어요/);
    expect(sanitizeStep({ type: "blank", text: "빈칸 없음" }).problem).toMatch(/빈칸이 없어요/);
    expect(sanitizeStep({ type: "puzzle", prompt: "p", answer: "가" }).problem).toMatch(/2~10글자/);
    expect(sanitizeStep({ type: "nope" }).step).toBeNull();
  });

  it("removes blank distractors that equal an answer and trims lists", () => {
    const { step } = sanitizeStep({ type: "blank", text: "[[소수]]", distractors: ["소수", " 배수 ", ""] });
    expect(step).toMatchObject({ distractors: ["배수"] });
    const { step: short } = sanitizeStep({ type: "short", prompt: "q", answers: [" 3 ", ""] });
    expect(short).toMatchObject({ answers: ["3"] });
  });

  it("sample units are valid and short (2~3분)", () => {
    const units = SAMPLE_COURSES.flatMap((c) => c.units);
    expect(units).toHaveLength(3);
    for (const u of units) {
      const { steps, problems } = sanitizeSteps(u.steps);
      expect(problems).toEqual([]);
      expect(steps).toHaveLength(u.steps.length);
      expect(estimateMinutes(u.steps)).toBeLessThanOrEqual(3);
      // 예제는 모든 문제 유형을 보여준다
      expect(new Set(u.steps.map((s) => s.type))).toEqual(new Set(["summary", "choice", "short", "blank", "puzzle"]));
      expect(SAMPLE_COURSES[0].sections).toContain(u.section);
    }
  });
});

describe("lesson flow", () => {
  const steps: Step[] = [
    { type: "summary", title: "t", body: "b", points: [] },
    { type: "choice", prompt: "q1", choices: ["a", "b"], answer: "a", explanation: "" },
    { type: "short", prompt: "q2", answers: ["1"], explanation: "" },
  ];

  it("requeues a wrong question once and scores first tries", () => {
    let s = startLesson(steps);
    s = advance(s); // 정리
    s = recordResult(s, 1, false);
    expect(s.queue).toEqual([0, 1, 2, 1]);
    s = advance(s);
    s = recordResult(s, 2, true);
    s = advance(s);
    expect(currentStep(s)).toBe(1);
    s = recordResult(s, 1, false); // 두 번째로 틀려도 다시 넣지 않는다
    expect(s.queue).toEqual([0, 1, 2, 1]);
    s = advance(s);
    expect(isFinished(s)).toBe(true);
    expect(lessonScore(steps, s)).toEqual({ correct: 1, total: 2 });
  });

  it("gives xp for first completion and less for replays", () => {
    expect(lessonXp({ correct: 4, total: 5 }, true)).toBe(180);
    expect(lessonXp({ correct: 5, total: 5 }, false)).toBe(50);
    expect(cappedSeconds(0, 3_600_000, 4)).toBe(360);
    expect(cappedSeconds(0, 100_000, 4)).toBe(100);
  });

  it("unlocks units in order", () => {
    const outline = {
      sections: [
        { units: [{ id: "a" }, { id: "b" }] },
        { units: [{ id: "c" }] },
      ],
    } as never;
    expect([...unitStates(outline, new Set()).values()]).toEqual(["current", "locked", "locked"]);
    expect([...unitStates(outline, new Set(["a"])).values()]).toEqual(["done", "current", "locked"]);
    // 관리자가 뒤 유닛을 완료로 표시해도 그 유닛은 다시 할 수 있다
    expect([...unitStates(outline, new Set(["c"])).values()]).toEqual(["current", "locked", "done"]);
    expect(nextUnitId(outline, new Set(["a"]), "a")).toBe("b");
    expect(nextUnitId(outline, new Set(["a", "b", "c"]), "c")).toBeUndefined();
  });
});

describe("math preview", () => {
  it("turns typed symbols into KaTeX", () => {
    expect(toLatex("x²+√(2)")).toBe("x^{2}+\\sqrt{2}");
    expect(toLatex("3/4")).toBe("\\frac{3}{4}");
    expect(toLatex("2^3×5")).toBe("2^{3}\\times 5");
  });
});
