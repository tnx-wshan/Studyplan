import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { HomeStudyDB, setDB } from "./index";
import { completeOnboarding, getProfile, grantXp } from "./profile";
import { exportBackup, importBackup } from "./backup";

let n = 0;
beforeEach(() => {
  setDB(new HomeStudyDB(`test-${n++}`));
});

const input = { nickname: "원섭", grade: "h1", goal: "내신 1등급", petSpecies: "sprout", petName: "쑥쑥이" } as const;

describe("profile", () => {
  it("onboarding creates profile and five default subjects", async () => {
    await completeOnboarding({ ...input });
    const p = await getProfile();
    expect(p?.pet).toEqual({ species: "sprout", name: "쑥쑥이" });
    const { getDB } = await import("./index");
    const subjects = await getDB().subjects.toArray();
    expect(subjects.map((s) => s.name).sort()).toEqual(["과학", "국어", "사회", "수학", "영어"].sort());
  });

  it("grantXp adds xp, coins and an event", async () => {
    await completeOnboarding({ ...input });
    await grantXp(120, "other");
    const p = await getProfile();
    expect(p?.totalXp).toBe(120);
    expect(p?.coins).toBe(12);
  });

  it("backup round-trips", async () => {
    await completeOnboarding({ ...input });
    await grantXp(50, "other");
    const json = await exportBackup();
    setDB(new HomeStudyDB(`test-${n++}`));
    expect(await getProfile()).toBeUndefined();
    await importBackup(json);
    expect((await getProfile())?.totalXp).toBe(50);
  });

  it("rejects non-homestudy backups", async () => {
    await expect(importBackup(JSON.stringify({ foo: 1 }))).rejects.toThrow();
  });
});

describe("level up", () => {
  it("records the level before a level-up until dismissed", async () => {
    const { dismissLevelUp } = await import("./profile");
    await completeOnboarding({ ...input });
    await grantXp(50, "other");
    expect((await getProfile())?.levelUpFrom).toBeUndefined();
    await grantXp(60, "other"); // 110 XP → Lv.2
    expect((await getProfile())?.levelUpFrom).toBe(1);
    await grantXp(200, "other"); // 아직 확인 안 함: 처음 레벨 유지
    expect((await getProfile())?.levelUpFrom).toBe(1);
    await dismissLevelUp();
    expect((await getProfile())?.levelUpFrom).toBeUndefined();
  });
});
