import { describe, expect, it } from "vitest";
import { QUESTIONS, recommendedMethods, scoreDiagnosis, weakDimensions } from "@/data/diagnosis";
import { METHODS, SITUATIONS, methodById, sortForSubject } from "@/data/methods";
import { monthPeriod, periodFor, shiftPeriod, weekKey, weekPeriod } from "./period";
import { change, computeReport, type ReportInput } from "./report";

describe("methods data", () => {
  it("has unique ids and valid references", () => {
    const ids = METHODS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SITUATIONS) for (const id of s.methods) expect(methodById(id), `${s.id}:${id}`).toBeDefined();
  });
  it("sorts subject-fitting methods first", () => {
    // cornell은 수학에 맞지 않아 뒤로
    expect(sortForSubject(["cornell", "retrieval"], "math").map((m) => m.id)).toEqual(["retrieval", "cornell"]);
    expect(sortForSubject(["cornell", "retrieval"]).map((m) => m.id)).toEqual(["cornell", "retrieval"]);
  });
});

describe("diagnosis", () => {
  const all = (v: number) => Object.fromEntries(QUESTIONS.map((q) => [q.id, v]));
  it("scores with reversed items", () => {
    const s = scoreDiagnosis(all(5));
    // 모든 문항 '매우 그렇다': 역문항이 있는 영역은 중간
    expect(s.plan).toBe(100);
    expect(s.focus).toBe(50);
  });
  it("finds weak areas and recommends methods", () => {
    const answers = { ...all(4), t1: 5, t2: 1 }; // 다시 읽기만 함
    const scores = scoreDiagnosis(answers);
    expect(scores.retrieval).toBe(0);
    expect(weakDimensions(scores)[0]).toBe("retrieval");
    expect(recommendedMethods(scores).slice(0, 2)).toEqual(["retrieval", "blank"]);
  });
  it("recommends core methods when nothing is weak", () => {
    const good = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.reverse ? 1 : 5]));
    expect(weakDimensions(scoreDiagnosis(good))).toEqual([]);
    expect(recommendedMethods(scoreDiagnosis(good))).toEqual(["retrieval", "spaced", "interleaving"]);
  });
});

describe("period", () => {
  it("computes ISO weeks across year boundaries", () => {
    expect(weekKey("2026-11-09")).toBe("2026-W46");
    expect(weekKey("2026-01-01")).toBe("2026-W01"); // 목요일
    expect(weekKey("2027-01-01")).toBe("2026-W53"); // 금요일 → 전년도 마지막 주
    expect(weekKey("2024-12-30")).toBe("2025-W01");
  });
  it("round-trips week periods", () => {
    const p = weekPeriod("2026-W46");
    expect(p).toMatchObject({ start: "2026-11-09", end: "2026-11-16" });
    expect(weekPeriod(weekKey("2027-01-01")).start).toBe("2026-12-28");
  });
  it("builds and shifts months", () => {
    expect(monthPeriod("2026-02")).toMatchObject({ start: "2026-02-01", end: "2026-03-01" });
    expect(shiftPeriod(monthPeriod("2026-01"), -1).key).toBe("2025-12");
    expect(shiftPeriod(periodFor("week", "2026-11-11"), 1).start).toBe("2026-11-16");
  });
});

describe("report", () => {
  const ts = (d: string, h = 12) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00`).getTime();
  const base = { createdAt: 0, updatedAt: 0 };
  const input: ReportInput = {
    sessions: [
      { ...base, id: "s1", date: "2026-11-09", startedAt: 0, endedAt: 0, focusMinutes: 30, mode: "pomodoro", subjectId: "m" },
      { ...base, id: "s2", date: "2026-11-10", startedAt: 0, endedAt: 0, focusMinutes: 20, mode: "free" },
      { ...base, id: "s3", date: "2026-11-02", startedAt: 0, endedAt: 0, focusMinutes: 99, mode: "free" },
    ],
    tasks: [
      { ...base, id: "t1", date: "2026-11-09", title: "a", kind: "custom", done: true, order: 1 },
      { ...base, id: "t2", date: "2026-11-11", title: "b", kind: "custom", done: false, order: 2 },
    ],
    xpEvents: [
      { id: "e1", at: 0, date: "2026-11-09", amount: 2, reason: "card" },
      { id: "e2", at: 0, date: "2026-11-12", amount: 5, reason: "wrong" },
      { id: "e3", at: 0, date: "2026-11-13", amount: 15, reason: "method" },
    ],
    wrongAnswers: [
      { ...base, createdAt: ts("2026-11-09"), id: "w1", question: "q", myAnswer: "", correctAnswer: "", reason: "mistake", nextRetry: "", streak: 3, mastered: true, retries: [{ at: ts("2026-11-12"), correct: true }] },
    ],
    quizzes: [{ ...base, id: "q1", title: "", materialIds: [], difficulty: "normal", verified: false, madeBy: "", attempts: [{ at: ts("2026-11-10"), score: 3, total: 5 }] }],
    questions: [],
    methodLogs: [{ ...base, id: "l1", methodId: "blank", date: "2026-11-13", fields: {} }],
  };

  it("aggregates one week", () => {
    const r = computeReport(input, weekPeriod("2026-W46"));
    expect(r).toMatchObject({
      totalMinutes: 50,
      days: 7,
      tasksPlanned: 2,
      tasksDone: 1,
      cardsReviewed: 1,
      wrongAdded: 1,
      wrongRetried: 1,
      wrongMastered: 1,
      quizCorrect: 3,
      quizTotal: 5,
      xp: 22,
    });
    expect(r.studyDays).toBe(4); // 9, 10, 12, 13일
    expect(r.bySubject).toEqual([
      { subjectId: "m", minutes: 30 },
      { subjectId: "none", minutes: 20 },
    ]);
    expect(r.wrongByReason.mistake).toBe(1);
    expect(r.methodPractices).toEqual([{ methodId: "blank", count: 1 }]);
    expect(r.byDay).toHaveLength(7);
  });

  it("computes change", () => {
    expect(change(120, 100)).toBe(20);
    expect(change(50, 0)).toBeNull();
  });
});
