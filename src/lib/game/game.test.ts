import { describe, expect, it } from "vitest";
import { levelFromXp, xpToNext } from "./level";
import { moodFromDaysSince, nextStage, stageForLevel } from "./pet";
import { computeStreak, daysToFreeze } from "./streak";

describe("level", () => {
  it("starts at level 1", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, current: 0, needed: 100, progress: 0 });
  });
  it("levels up at exact thresholds", () => {
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(100 + xpToNext(2)).level).toBe(3);
  });
  it("tracks progress within a level", () => {
    const info = levelFromXp(175);
    expect(info).toMatchObject({ level: 2, current: 75, needed: 150 });
    expect(info.progress).toBeCloseTo(0.5);
  });
  it("treats negative xp as zero", () => {
    expect(levelFromXp(-50).level).toBe(1);
  });
});

describe("pet", () => {
  it("grows by level", () => {
    expect(stageForLevel(1).stage).toBe("egg");
    expect(stageForLevel(4).stage).toBe("baby");
    expect(stageForLevel(5).stage).toBe("child");
    expect(stageForLevel(25).stage).toBe("adult");
    expect(nextStage(25)).toBeNull();
    expect(nextStage(3)?.stage).toBe("child");
  });
  it("mood follows days since last study", () => {
    expect(moodFromDaysSince(null)).toBe("happy");
    expect(moodFromDaysSince(0)).toBe("excited");
    expect(moodFromDaysSince(1)).toBe("happy");
    expect(moodFromDaysSince(3)).toBe("sad");
    expect(moodFromDaysSince(4)).toBe("sleepy");
  });
});

describe("streak", () => {
  const today = "2026-11-09";
  it("is zero with no records", () => {
    expect(computeStreak([], today)).toEqual({ current: 0, longest: 0, studiedToday: false });
  });
  it("counts consecutive days including today", () => {
    expect(computeStreak(["2026-11-07", "2026-11-08", "2026-11-09"], today)).toMatchObject({
      current: 3,
      studiedToday: true,
    });
  });
  it("keeps the streak alive until today ends", () => {
    expect(computeStreak(["2026-11-07", "2026-11-08"], today).current).toBe(2);
  });
  it("breaks after a missed day and remembers the longest run", () => {
    const s = computeStreak(["2026-10-01", "2026-10-02", "2026-10-03", "2026-11-09"], today);
    expect(s).toEqual({ current: 1, longest: 3, studiedToday: true });
  });
  it("handles month and year boundaries", () => {
    expect(computeStreak(["2025-12-31", "2026-01-01"], "2026-01-01").current).toBe(2);
  });
});

describe("streak freeze", () => {
  const today = "2026-11-12";
  it("bridges a frozen day without counting it", () => {
    // 9, 10 공부 / 11 보호권 / 12 공부
    const s = computeStreak(["2026-11-09", "2026-11-10", "2026-11-12"], today, ["2026-11-11"]);
    expect(s).toEqual({ current: 3, longest: 3, studiedToday: true });
    expect(computeStreak(["2026-11-09", "2026-11-10", "2026-11-12"], today).current).toBe(1);
  });
  it("keeps the streak alive today after a frozen yesterday", () => {
    expect(computeStreak(["2026-11-09", "2026-11-10"], today, ["2026-11-11"]).current).toBe(2);
  });
  it("picks days to freeze only when freezes cover the whole gap", () => {
    const days = ["2026-11-09", "2026-11-10"];
    expect(daysToFreeze(days, [], 1, today)).toEqual(["2026-11-11"]);
    expect(daysToFreeze(days, [], 0, today)).toEqual([]);
    expect(daysToFreeze(days, ["2026-11-11"], 1, today)).toEqual([]); // 이미 메움
    expect(daysToFreeze(days, [], 1, "2026-11-13")).toEqual([]); // 이틀 빠짐, 보호권 1개
    expect(daysToFreeze(days, [], 2, "2026-11-13")).toEqual(["2026-11-11", "2026-11-12"]);
    expect(daysToFreeze([], [], 2, today)).toEqual([]); // 기록 없음
    expect(daysToFreeze(["2026-11-11"], [], 2, today)).toEqual([]); // 빠진 날 없음
  });
});
