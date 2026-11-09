import { describe, expect, it } from "vitest";
import { newSrs, previewLabel, review } from "./srs";
import { nextRetryAfter } from "./retry";
import { generateExamPlan, interleave, studyDaysBetween } from "./examPlan";

const NOW = new Date(2026, 10, 9, 21, 0).getTime(); // 2026-11-09 21:00 (월)
const DAY = 86_400_000;
const midnight = new Date(2026, 10, 9).getTime();

describe("srs", () => {
  it("new card: again repeats soon, good waits a day from midnight", () => {
    expect(review(newSrs(), 1, NOW).due).toBe(NOW + 60_000);
    const good = review(newSrs(), 3, NOW);
    expect(good.srs.interval).toBe(1);
    expect(good.due).toBe(midnight + DAY);
  });
  it("intervals grow with good answers", () => {
    let s = review(newSrs(), 3, NOW).srs;
    const intervals = [s.interval];
    for (let i = 0; i < 3; i++) {
      s = review(s, 3, NOW).srs;
      intervals.push(s.interval);
    }
    expect(intervals).toEqual([1, 3, 8, 20]);
  });
  it("a lapse resets interval and lowers ease", () => {
    const learned = { interval: 10, ease: 2.5, reps: 4, lapses: 0 };
    const r = review(learned, 1, NOW);
    expect(r.srs).toMatchObject({ interval: 0, ease: 2.3, lapses: 1 });
  });
  it("orders button previews again < hard < good < easy", () => {
    const s = { interval: 4, ease: 2.5, reps: 3, lapses: 0 };
    const dues = ([1, 2, 3, 4] as const).map((r) => review(s, r, NOW).due);
    expect([...dues].sort((a, b) => a - b)).toEqual(dues);
    expect(previewLabel(s, 1, NOW)).toBe("1분");
    expect(previewLabel(s, 3, NOW)).toBe("10일");
  });
  it("keeps ease within bounds", () => {
    let s = { interval: 2, ease: 1.35, reps: 2, lapses: 0 };
    s = review(s, 2, NOW).srs;
    expect(s.ease).toBe(1.3);
  });
});

describe("wrong answer retry", () => {
  it("steps 1 → 3 → 7 days and masters after 3 correct", () => {
    let st = { streak: 0 };
    const a = nextRetryAfter(st, true, "2026-11-09");
    expect(a).toEqual({ streak: 1, mastered: false, nextRetry: "2026-11-12" });
    st = a;
    const b = nextRetryAfter(st, true, "2026-11-12");
    expect(b.nextRetry).toBe("2026-11-19");
    const c = nextRetryAfter(b, true, "2026-11-19");
    expect(c.mastered).toBe(true);
  });
  it("resets on a wrong answer", () => {
    expect(nextRetryAfter({ streak: 2 }, false, "2026-11-09")).toEqual({ streak: 0, mastered: false, nextRetry: "2026-11-10" });
  });
});

describe("exam plan", () => {
  it("excludes rest days and the exam day", () => {
    // 11/9(월) ~ 11/15(일) 시험 → 11/9~11/14, 토(6) 제외
    expect(studyDaysBetween("2026-11-09", "2026-11-15", [6])).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
    ]);
  });

  it("interleaves subjects", () => {
    expect(interleave([{ subjectId: "k", units: ["k1", "k2"] }, { subjectId: "m", units: ["m1"] }]).map((x) => x.unit)).toEqual(["k1", "m1", "k2"]);
  });

  it("splits learn / review / final and covers every unit once", () => {
    const plan = generateExamPlan({
      startDate: "2026-11-09",
      examDate: "2026-11-23",
      ranges: [
        { subjectId: "math", units: ["u1", "u2", "u3", "u4", "u5"] },
        { subjectId: "eng", units: ["e1", "e2", "e3"] },
      ],
      minutesPerDay: 120,
      restDays: [],
    });
    expect(plan.studyDays).toHaveLength(14);
    expect(plan).toMatchObject({ learnDays: 9, reviewDays: 4, hasFinalDay: true });
    const learn = plan.tasks.filter((t) => t.kind === "learn");
    expect(learn.map((t) => t.unit).sort()).toEqual(["e1", "e2", "e3", "u1", "u2", "u3", "u4", "u5"]);
    // 개념 학습은 앞쪽 9일 안에
    expect(learn.every((t) => t.date <= plan.studyDays[8])).toBe(true);
    const final = plan.tasks.filter((t) => t.kind === "final");
    expect(final.map((t) => t.date)).toEqual(["2026-11-22", "2026-11-22"]);
    // 범위 복습에 두 과목 모두 포함
    expect(new Set(plan.tasks.filter((t) => t.kind === "review").map((t) => t.subjectId))).toEqual(new Set(["math", "eng"]));
  });

  it("packs many units into few days", () => {
    const plan = generateExamPlan({
      startDate: "2026-11-09",
      examDate: "2026-11-11",
      ranges: [{ subjectId: "s", units: ["a", "b", "c", "d", "e"] }],
      minutesPerDay: 60,
      restDays: [],
    });
    // 2일: 개념 1일 + 총정리 1일
    expect(plan.tasks.filter((t) => t.kind === "learn")).toHaveLength(5);
    expect(plan.tasks.every((t) => t.estimatedMinutes >= 15)).toBe(true);
  });

  it("reports problems", () => {
    expect(generateExamPlan({ startDate: "2026-11-09", examDate: "2026-11-09", ranges: [{ subjectId: "s", units: ["a"] }], minutesPerDay: 60, restDays: [] }).problem).toBe("no-days");
    expect(generateExamPlan({ startDate: "2026-11-09", examDate: "2026-11-20", ranges: [], minutesPerDay: 60, restDays: [] }).problem).toBe("no-units");
  });
});
