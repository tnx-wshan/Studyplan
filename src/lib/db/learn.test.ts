import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { HomeStudyDB, getDB, setDB } from "./index";
import { completeOnboarding, getProfile } from "./profile";
import { dailyLearn, doneUnitIds, finishUnit } from "./learn";
import { applyCommands, buildSnapshot, ensureServerId } from "./sync";
import { exportBackup, importBackup } from "./backup";
import { toDateKey } from "@/lib/date";

let n = 0;
beforeEach(async () => {
  setDB(new HomeStudyDB(`learn-${n++}`));
  await completeOnboarding({ nickname: "민수", grade: "m1", goal: "", petSpecies: "sprout", petName: "새싹" });
});

const cmd = (id: number, type: string, payload: Record<string, unknown>) => ({ id, type, payload, createdAt: 0, appliedAt: null }) as never;

describe("learn progress", () => {
  it("records a unit, grants xp once in full, and tracks the daily goal", async () => {
    const r1 = await finishUnit({ unitId: "u1", courseKey: "m1:math", title: "소수", score: { correct: 4, total: 5 }, seconds: 150 });
    expect(r1).toEqual({ xp: 180, first: true });
    const r2 = await finishUnit({ unitId: "u1", courseKey: "m1:math", title: "소수", score: { correct: 5, total: 5 }, seconds: 160 });
    expect(r2).toEqual({ xp: 50, first: false });
    expect((await getProfile())?.totalXp).toBe(230);
    const p = await getDB().learnProgress.get("u1");
    expect(p).toMatchObject({ attempts: 2, bestCorrect: 5 });
    const d = await dailyLearn();
    expect(d).toMatchObject({ goalMinutes: 5, todaySeconds: 310, todayUnits: 2, goalStreak: 1 });
    expect(d.week.find((w) => w.date === toDateKey())?.seconds).toBe(310);
    expect([...(await doneUnitIds("m1:math"))]).toEqual(["u1"]);
  });

  it("builds a sync snapshot", async () => {
    await finishUnit({ unitId: "u1", courseKey: "m1:math", title: "소수", score: { correct: 1, total: 1 }, seconds: 60 });
    const id = await ensureServerId();
    expect(await ensureServerId()).toBe(id);
    const s = await buildSnapshot();
    expect(s).toMatchObject({ level: 0, totalXp: 120, learnDone: ["u1"], learnTodaySec: 60, streak: 1 });
  });

  it("applies admin commands once, in order", async () => {
    await finishUnit({ unitId: "u1", courseKey: "m1:math", title: "", score: { correct: 1, total: 1 }, seconds: 60 });
    const last = await applyCommands([
      cmd(3, "learnComplete", { unitId: "u2", courseKey: "m1:math" }),
      cmd(1, "setXp", { totalXp: 500 }),
      cmd(2, "setCoins", { coins: 7 }),
      cmd(4, "setNickname", { nickname: "민수2" }),
      cmd(5, "setFreezes", { freezes: 5 }),
    ]);
    expect(last).toBe(5);
    let p = await getProfile();
    expect(p).toMatchObject({ totalXp: 500, coins: 7, nickname: "민수2", freezes: 2, lastCommandId: 5 });
    expect([...(await doneUnitIds())].sort()).toEqual(["u1", "u2"]);
    // 같은 명령을 다시 받아도 두 번 적용하지 않는다
    await applyCommands([cmd(1, "setXp", { totalXp: 1 })]);
    p = await getProfile();
    expect(p?.totalXp).toBe(500);
    await applyCommands([cmd(6, "learnReset", { unitId: "u1" }), cmd(7, "learnResetCourse", { courseKey: "other" })]);
    expect([...(await doneUnitIds())]).toEqual(["u2"]);
    await applyCommands([cmd(8, "learnResetCourse", { courseKey: "m1:math" })]);
    expect((await doneUnitIds()).size).toBe(0);
  });

  it("backs up learning tables", async () => {
    await finishUnit({ unitId: "u1", courseKey: "m1:math", title: "소수", score: { correct: 1, total: 1 }, seconds: 60 });
    const json = await exportBackup();
    setDB(new HomeStudyDB(`learn-${n++}`));
    await importBackup(json);
    expect(await getDB().learnProgress.count()).toBe(1);
    expect(await getDB().learnLogs.count()).toBe(1);
  });
});
