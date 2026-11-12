import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { HomeStudyDB, getDB, setDB } from "./index";
import { completeOnboarding, getProfile, grantXp, updateProfile } from "./profile";
import { exportBackup, importBackup } from "./backup";
import { xpForLevel } from "@/lib/game/level";

let n = 0;
beforeEach(async () => {
  setDB(new HomeStudyDB(`levels-${n++}`));
  await completeOnboarding({ nickname: "민수", grade: "m1", goal: "", petSpecies: "sprout", petName: "새싹" });
});

describe("레벨업 보상", () => {
  it("오른 레벨들의 코인·보호권·꾸미기를 한 번에 주고, 다시 주지 않는다", async () => {
    await grantXp(xpForLevel(3), "other"); // 0 → 3레벨
    let p = (await getProfile())!;
    // 코인: 경험치 450 + 레벨 보상 50+100+150
    expect(p.coins).toBe(Math.floor(xpForLevel(3) / 100) + 300);
    expect(p.freezes).toBe(1); // 2레벨
    expect(p.owned).toEqual(["glasses"]); // 3레벨
    expect(p.rewardedLevel).toBe(3);
    expect(p.levelUpFrom).toBe(0);
    await grantXp(100, "other");
    p = (await getProfile())!;
    expect(p.freezes).toBe(1);
    expect(p.owned).toEqual(["glasses"]);
  });

  it("이미 가진 꾸미기는 그 값만큼 코인으로, 보호권은 보관 한도까지", async () => {
    await updateProfile({ owned: ["glasses"], freezes: 2 });
    const before = (await getProfile())!.coins;
    await grantXp(xpForLevel(3), "other");
    const p = (await getProfile())!;
    expect(p.freezes).toBe(2); // 한도 2 (레벨 10부터 3)
    expect(p.coins).toBe(before + Math.floor(xpForLevel(3) / 100) + 300 + 30); // 안경 값 30
  });
});

describe("레벨 개편 이전 데이터", () => {
  it("기기 DB 6번째 버전에서 경험치를 10배로 바꾼다", async () => {
    const name = `old-${n++}`;
    // 5번째 버전까지의 구조로 예전 데이터를 넣는다
    const old = new Dexie(name);
    old.version(5).stores({ profile: "id", xpEvents: "id, date", learnProgress: "id, courseKey", learnLogs: "id, date, unitId" });
    await old.open();
    await old.table("profile").put({ id: "me", nickname: "옛", totalXp: 1234, coins: 120, levelUpFrom: 3 });
    await old.table("xpEvents").put({ id: "e1", at: 0, date: "2026-11-01", amount: 25, reason: "focus" });
    old.close();

    setDB(new HomeStudyDB(name));
    const p = await getDB().profile.get("me");
    expect(p).toMatchObject({ totalXp: 12_340, coins: 120 });
    expect(p?.levelUpFrom).toBeUndefined();
    expect((await getDB().xpEvents.get("e1"))?.amount).toBe(250);
  });

  it("예전 백업을 불러오면 경험치를 10배로, 지금 백업은 그대로", async () => {
    await grantXp(500, "other");
    const now = JSON.parse(await exportBackup());
    await importBackup(JSON.stringify(now));
    expect((await getProfile())?.totalXp).toBe(500);
    await importBackup(JSON.stringify({ ...now, schema: 5 }));
    expect((await getProfile())?.totalXp).toBe(5_000);
    expect((await getDB().xpEvents.toArray())[0].amount).toBe(5_000);
  });
});
