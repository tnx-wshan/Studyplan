import { describe, expect, it } from "vitest";
import { MAX_LEVEL, levelFromXp, xpForLevel, xpToNext } from "./level";
import { cardFrame, mapSkinUnlocked, maxFreezes, rewardsForLevel } from "./rewards";
import { activeCharacter, growthStage } from "@/data/characters";
import { moodFromDaysSince, nextStage, stageForLevel } from "./pet";
import { computeStreak, daysToFreeze } from "./streak";

describe("level", () => {
  it("starts at level 0 and needs 10,000 XP for level 1", () => {
    expect(levelFromXp(0)).toEqual({ level: 0, current: 0, needed: 10_000, progress: 0, max: false });
  });
  it("needs 5,000 more XP for each next level (1,150,000 to level 20)", () => {
    expect(levelFromXp(9_999).level).toBe(0);
    expect(levelFromXp(10_000).level).toBe(1);
    expect(xpToNext(1)).toBe(15_000);
    expect([1, 2, 3, 4, 5, 10, 20].map(xpForLevel)).toEqual([10_000, 25_000, 45_000, 70_000, 100_000, 325_000, 1_150_000]);
    expect(levelFromXp(24_999).level).toBe(1);
    expect(levelFromXp(25_000).level).toBe(2);
    for (let lv = 0; lv <= MAX_LEVEL; lv++) expect(levelFromXp(xpForLevel(lv)).level).toBe(lv);
  });
  it("tracks progress within a level and stops at level 20", () => {
    const info = levelFromXp(17_500);
    expect(info).toMatchObject({ level: 1, current: 7_500, needed: 15_000 });
    expect(info.progress).toBeCloseTo(0.5);
    expect(levelFromXp(5_000_000)).toMatchObject({ level: 20, needed: 0, progress: 1, max: true });
  });
  it("treats negative xp as zero", () => {
    expect(levelFromXp(-50).level).toBe(0);
  });
});

describe("level rewards", () => {
  it("gives story and coins every level, plus the scheduled extras", () => {
    expect(rewardsForLevel(0)).toEqual([]);
    expect(rewardsForLevel(1)).toEqual([{ kind: "story" }, { kind: "coins", amount: 50 }]);
    expect(rewardsForLevel(2).map((r) => r.kind)).toEqual(["story", "coins", "freeze"]);
    expect(rewardsForLevel(3)).toContainEqual({ kind: "item", itemId: "glasses" });
    expect(rewardsForLevel(4)).toContainEqual({ kind: "growth", stage: 1 });
    expect(rewardsForLevel(5)).toContainEqual({ kind: "mapSkin", skin: "lantern" });
    expect(rewardsForLevel(10).map((r) => r.kind)).toEqual(["story", "coins", "freeze", "character", "frame"]);
    expect(rewardsForLevel(15)).toContainEqual({ kind: "mapSkin", skin: "gilded" });
    expect(rewardsForLevel(20).map((r) => r.kind)).toEqual(["story", "coins", "growth", "sideStory", "frame", "scene"]);
    expect(rewardsForLevel(21)).toEqual([]);
  });
  it("unlocks frames, map skins, freeze slots and the second character by level", () => {
    expect([0, 9, 10, 19, 20].map(cardFrame)).toEqual([null, null, "silver", "silver", "gold"]);
    expect([mapSkinUnlocked("lantern", 4), mapSkinUnlocked("lantern", 5), mapSkinUnlocked("gilded", 14), mapSkinUnlocked("gilded", 15)]).toEqual([false, true, false, true]);
    expect([maxFreezes(9), maxFreezes(10)]).toEqual([2, 3]);
    expect([0, 3, 4, 19, 20].map(growthStage)).toEqual([0, 0, 1, 4, 5]);
    expect(activeCharacter(undefined, "noir", 0).id).toBe("ren");
    expect(activeCharacter("moa", "noir", 9).id).toBe("ren");
    expect(activeCharacter("moa", "noir", 10).id).toBe("moa");
    expect(activeCharacter(undefined, "cute", 0).id).toBe("moa");
  });
});

describe("pet", () => {
  it("grows by level", () => {
    expect(stageForLevel(0).stage).toBe("egg");
    expect(stageForLevel(4).stage).toBe("baby");
    expect(stageForLevel(8).stage).toBe("child");
    expect(stageForLevel(20).stage).toBe("adult");
    expect(nextStage(20)).toBeNull();
    expect(nextStage(5)?.stage).toBe("child");
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
