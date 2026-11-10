import { describe, expect, it } from "vitest";
import type { Task, WrongAnswer } from "@/lib/db/types";
import { computeMemory, memoryKey, retentionAt, reviewForecast, stabilityFor, statusFor } from "./memory";

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 20, 12).getTime();
const task = (unit: string, daysAgo: number, over: Partial<Task> = {}): Task => ({
  id: `${unit}-${daysAgo}`,
  date: "2026-11-01",
  title: unit,
  kind: "learn",
  unit,
  subjectId: "m",
  done: true,
  doneAt: NOW - daysAgo * DAY,
  order: 1,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe("memory model", () => {
  it("stability doubles with each review and is capped", () => {
    expect([1, 2, 3, 4].map(stabilityFor)).toEqual([2, 4, 8, 16]);
    expect(stabilityFor(20)).toBe(60);
  });
  it("retention decays and maps to a status", () => {
    expect(retentionAt(0, 2)).toBe(100);
    expect(retentionAt(2, 2)).toBe(37);
    expect(statusFor(80)).toBe("fresh");
    expect(statusFor(60)).toBe("fading");
    expect(statusFor(30)).toBe("risk");
  });
  it("more reviews keep the same gap fresher", () => {
    const once = computeMemory([task("a", 4)], [], NOW).get(memoryKey("m", "a"))!;
    const thrice = computeMemory([task("a", 12), task("a", 8), task("a", 4)], [], NOW).get(memoryKey("m", "a"))!;
    expect(once).toMatchObject({ reviews: 1, daysSince: 4, status: "risk" });
    expect(thrice).toMatchObject({ reviews: 3, daysSince: 4, stability: 8 });
    expect(thrice.retention).toBeGreaterThan(once.retention);
  });
  it("ignores undone tasks and counts correct wrong-answer retries", () => {
    const wrong: WrongAnswer = {
      id: "w",
      subjectId: "m",
      unitId: "a",
      question: "",
      myAnswer: "",
      correctAnswer: "",
      reason: "concept",
      nextRetry: "2026-11-21",
      streak: 1,
      mastered: false,
      retries: [
        { at: NOW - DAY, correct: true },
        { at: NOW - 3 * DAY, correct: false },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    const m = computeMemory([task("a", 10), task("b", 1, { done: false, doneAt: undefined })], [wrong], NOW);
    expect(m.has(memoryKey("m", "b"))).toBe(false);
    expect(m.get(memoryKey("m", "a"))).toMatchObject({ reviews: 2, daysSince: 1, openWrong: 1 });
  });
});

describe("review forecast", () => {
  it("puts overdue items on today and the rest on their day", () => {
    const today = "2026-11-20";
    const at = (d: string) => new Date(`${d}T09:00:00`).getTime();
    const f = reviewForecast(
      [{ due: at("2026-11-18") }, { due: at("2026-11-20") }, { due: at("2026-11-21") }, { due: at("2026-12-25") }],
      [
        { nextRetry: "2026-11-19", mastered: false },
        { nextRetry: "2026-11-21", mastered: false },
        { nextRetry: "2026-11-21", mastered: true },
      ],
      [
        { date: "2026-11-21", kind: "spaced", done: false },
        { date: "2026-11-21", kind: "custom", done: false },
        { date: "2026-11-22", kind: "spaced", done: true },
      ],
      today,
      3,
    );
    expect(f.map((d) => d.total)).toEqual([3, 3, 0]);
    expect(f[1]).toEqual({ date: "2026-11-21", cards: 1, wrong: 1, spaced: 1, total: 3 });
  });
});
