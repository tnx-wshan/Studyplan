import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { BADGES, earnedBadges, examProgress, type Totals } from "@/lib/game/achievements";
import { HomeStudyDB, getDB, setDB } from "./index";
import { completeOnboarding, getProfile, grantXp } from "./profile";
import { addTask, createExam, recordStudySession, setTaskDone } from "./study";
import { buyItem, claimExamMilestone, claimWeeklyQuest, equipItem, examQuestStatus, setTitleBadge, syncBadges, weeklyStatus } from "./game";
import { saveReflection } from "./coaching";

let n = 0;
beforeEach(async () => {
  setDB(new HomeStudyDB(`game-${n++}`));
  await completeOnboarding({ nickname: "a", grade: "h2", goal: "", petSpecies: "cloud", petName: "b" });
});

const TODAY = "2026-11-11"; // 수요일, 2026-W46
const at = (d: string, h = 12) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00`).getTime();
const zero: Totals = { longestStreak: 0, totalMinutes: 0, cardsReviewed: 0, wrongMastered: 0, quizzesFinished: 0, methodsTried: 0, reflections: 0, level: 1, tasksDone: 0 };

describe("badges (pure)", () => {
  it("has unique ids", () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });
  it("earns badges by thresholds", () => {
    expect(earnedBadges(zero)).toEqual([]);
    expect(earnedBadges({ ...zero, longestStreak: 7, totalMinutes: 600 })).toEqual(["streak3", "streak7", "focus10"]);
  });
});

describe("weekly quests", () => {
  it("tracks progress and claims once", async () => {
    await recordStudySession({ startedAt: at("2026-11-09"), endedAt: at("2026-11-09"), focusMinutes: 200, mode: "free" });
    await recordStudySession({ startedAt: at("2026-11-10"), endedAt: at("2026-11-10"), focusMinutes: 120, mode: "free" });
    await saveReflection("2026-W46", { good: "g", bad: "", nextGoal: "" }, at("2026-11-11"));
    const s = await weeklyStatus(TODAY);
    expect(s.week).toBe("2026-W46");
    const focus = s.quests.find((q) => q.quest.id === "wfocus")!;
    expect(focus).toMatchObject({ value: 300, done: true, claimed: false });
    expect(s.quests.find((q) => q.quest.id === "wreflect")?.done).toBe(true);
    expect(s.quests.find((q) => q.quest.id === "wdays")?.done).toBe(false);

    const before = (await getProfile())!.totalXp;
    expect(await claimWeeklyQuest("wfocus", TODAY)).toBe(true);
    expect(await claimWeeklyQuest("wfocus", TODAY)).toBe(false);
    expect(await claimWeeklyQuest("wdays", TODAY)).toBe(false);
    expect((await getProfile())!.totalXp).toBe(before + 100);
  });
});

describe("exam quests", () => {
  it("unlocks milestones by completion", async () => {
    const [math] = await getDB().subjects.filter((s) => s.group === "math").toArray();
    const { exam } = await createExam({ title: "기말", date: "2026-11-20", ranges: [{ subjectId: math.id, units: ["a", "b", "c", "d"] }], minutesPerDay: 60, restDays: [] }, TODAY);
    const tasks = await getDB().tasks.where("examId").equals(exam.id).toArray();
    const main = tasks.filter((t) => t.kind !== "spaced");
    for (const t of main.slice(0, Math.ceil(main.length / 2))) await setTaskDone(t.id, true);
    const [status] = await examQuestStatus(TODAY);
    expect(status.progress.pct).toBeGreaterThanOrEqual(50);
    expect(status.milestones.filter((m) => m.reached).map((m) => m.pct)).toEqual([25, 50]);
    expect(await claimExamMilestone(exam.id, 50, TODAY)).toBe(true);
    expect(await claimExamMilestone(exam.id, 50, TODAY)).toBe(false);
    expect(await claimExamMilestone(exam.id, 100, TODAY)).toBe(false);
    expect(examProgress(exam, await getDB().tasks.toArray()).total).toBe(main.length);
  });
});

describe("badge sync and titles", () => {
  it("records new badges once", async () => {
    for (let i = 0; i < 3; i++) {
      const t = await addTask({ date: TODAY, title: `t${i}` });
      await setTaskDone(t.id, true, at(`2026-11-0${7 + i}`));
    }
    expect(await syncBadges()).toEqual(["streak3"]);
    expect(await syncBadges()).toEqual([]);
    await setTitleBadge("streak3");
    expect((await getProfile())?.titleBadge).toBe("streak3");
    await setTitleBadge("nope");
    expect((await getProfile())?.titleBadge).toBe("streak3");
  });
});

describe("shop", () => {
  it("buys with coins, equips, and refuses duplicates or poverty", async () => {
    expect(await buyItem("halo")).toBe("coins");
    await grantXp(500, "other"); // +50 코인
    expect(await buyItem("halo")).toBe("ok");
    const p = (await getProfile())!;
    expect(p.coins).toBe(10);
    expect(p.equipped?.accessory).toBe("halo");
    expect(await buyItem("halo")).toBe("owned");
    expect(await buyItem("crimson")).toBe("coins");
    await equipItem("accessory", undefined);
    expect((await getProfile())?.equipped?.accessory).toBeUndefined();
    await equipItem("accessory", "scarf"); // 안 산 아이템은 착용 불가
    expect((await getProfile())?.equipped?.accessory).toBeUndefined();
  });
});
