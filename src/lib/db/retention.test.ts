import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { computeStreak } from "@/lib/game/streak";
import { HomeStudyDB, getDB, setDB } from "./index";
import { completeOnboarding, getProfile } from "./profile";
import { claimWeeklyQuest } from "./game";
import { saveReflection, addMethodLog } from "./coaching";
import { addTask, createExam, recordStudySession, setTaskDone } from "./study";
import {
  applyStreakFreeze,
  claimComebackQuest,
  claimWeeklyGoal,
  comebackStatus,
  detectComeback,
  maybeAwardFreeze,
  setWeeklyGoal,
  suggestGoal,
  tidyBacklog,
  weeklyGoalStatus,
} from "./retention";

let n = 0;
beforeEach(async () => {
  setDB(new HomeStudyDB(`ret-${n++}`));
  await completeOnboarding({ nickname: "a", grade: "h1", goal: "", petSpecies: "cloud", petName: "b" });
});

const at = (d: string, h = 12) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00`).getTime();
const focus = (d: string, minutes: number) => recordStudySession({ startedAt: at(d), endedAt: at(d) + minutes * 60_000, focusMinutes: minutes, mode: "free" });

describe("streak freeze", () => {
  it("is awarded once a week after three weekly quests, up to two", async () => {
    // 2026-W46: 300분 집중 + 학습법 3번 + 회고
    await focus("2026-11-09", 300);
    for (const m of ["blank", "feynman", "cornell"]) await addMethodLog({ methodId: m, fields: {} }, at("2026-11-10"));
    await saveReflection("2026-W46", { good: "g", bad: "", nextGoal: "" }, at("2026-11-11"));
    expect(await claimWeeklyQuest("wfocus", "2026-11-11")).toBe(true);
    expect(await claimWeeklyQuest("wmethod", "2026-11-11")).toBe(true);
    expect(await maybeAwardFreeze("2026-W46")).toBe(false); // 아직 2개
    expect(await claimWeeklyQuest("wreflect", "2026-11-11")).toBe(true);
    expect(await maybeAwardFreeze("2026-W46")).toBe(true);
    expect(await maybeAwardFreeze("2026-W46")).toBe(false); // 주마다 한 번
    expect((await getProfile())?.freezes).toBe(1);
  });

  it("auto-fills a missed day and keeps the streak", async () => {
    await focus("2026-11-09", 10);
    await focus("2026-11-10", 10);
    await getDB().profile.update("me", { freezes: 1 });
    // 11일을 빼먹고 12일에 앱을 열었다
    expect(await applyStreakFreeze("2026-11-12")).toEqual(["2026-11-11"]);
    expect(await applyStreakFreeze("2026-11-12")).toEqual([]);
    const p = (await getProfile())!;
    expect(p.freezes).toBe(0);
    expect(computeStreak(["2026-11-09", "2026-11-10"], "2026-11-12", p.frozenDays).current).toBe(2);
  });

  it("does not spend freezes when the gap is too long", async () => {
    await focus("2026-11-05", 10);
    await getDB().profile.update("me", { freezes: 2 });
    expect(await applyStreakFreeze("2026-11-12")).toEqual([]);
    expect((await getProfile())?.freezes).toBe(2);
  });
});

describe("comeback", () => {
  const today = new Date();
  const key = (offset: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  it("is detected after three or more days away, once per day", async () => {
    await focus(key(-5), 10);
    expect(await detectComeback(key(-3))).toBe(false); // 하루만 쉼
    expect(await detectComeback(key(0))).toBe(true);
    expect(await detectComeback(key(0))).toBe(false);
    expect((await getProfile())?.comeback).toEqual({ date: key(0), awayDays: 4 });
  });

  it("ignores brand-new users", async () => {
    expect(await detectComeback(key(0))).toBe(false);
    expect(await comebackStatus(key(0))).toBeNull();
  });

  it("offers light quests that are claimed once", async () => {
    await focus(key(-6), 10);
    await detectComeback(key(0));
    expect((await comebackStatus(key(0)))?.quests.every((q) => !q.done)).toBe(true);
    expect(await claimComebackQuest("c-focus", key(0))).toBe(false);
    await recordStudySession({ startedAt: Date.now() - 5 * 60_000, endedAt: Date.now(), focusMinutes: 5, mode: "pomodoro" });
    const before = (await getProfile())!.totalXp;
    expect(await claimComebackQuest("c-focus", key(0))).toBe(true);
    expect(await claimComebackQuest("c-focus", key(0))).toBe(false);
    expect((await getProfile())!.totalXp).toBe(before + 300);
    const s = await comebackStatus(key(0));
    expect(s?.quests.find((q) => q.quest.id === "c-focus")?.claimed).toBe(true);
  });
});

describe("tidy backlog", () => {
  it("removes overdue spaced reviews, replans upcoming exams, keeps own tasks", async () => {
    const [math] = await getDB().subjects.filter((s) => s.group === "math").toArray();
    const unitTask = await addTask({ date: "2026-11-01", title: "단원", unit: "u", subjectId: math.id });
    await setTaskDone(unitTask.id, true, at("2026-11-01")); // 2,4,8,15일 간격 복습 생성
    await addTask({ date: "2026-11-03", title: "내가 만든 할 일" });
    const { exam } = await createExam({ title: "기말", date: "2026-11-25", ranges: [{ subjectId: math.id, units: ["a", "b", "c", "d"] }], minutesPerDay: 60, restDays: [] }, "2026-11-05");

    const r = await tidyBacklog("2026-11-12");
    expect(r.removedReviews).toBe(3); // 2, 4, 8일 것
    expect(r.replannedExams).toBe(1);
    expect(r.left).toBe(1); // 직접 만든 할 일만 남음
    const examTasks = await getDB().tasks.where("examId").equals(exam.id).toArray();
    expect(examTasks.every((t) => t.done || t.date >= "2026-11-12")).toBe(true);
    expect(await getDB().tasks.filter((t) => t.kind === "spaced" && t.date === "2026-11-15").count()).toBe(1);
  });
});

describe("weekly goal", () => {
  it("suggests from last week and rewards once when reached", async () => {
    expect(suggestGoal(0)).toBe(180);
    expect(suggestGoal(200)).toBe(240);
    await focus("2026-11-03", 200); // 지난주
    await setWeeklyGoal(120, "2026-11-11");
    let s = await weeklyGoalStatus("2026-11-11");
    expect(s).toMatchObject({ week: "2026-W46", goal: 120, minutes: 0, lastWeek: 200, suggestion: 240, daysLeft: 5, perDay: 24, achieved: false });
    expect(await claimWeeklyGoal("2026-11-11")).toBe(false);
    await focus("2026-11-10", 130);
    s = await weeklyGoalStatus("2026-11-11");
    expect(s).toMatchObject({ minutes: 130, achieved: true, claimed: false, perDay: 0 });
    const before = (await getProfile())!.totalXp;
    expect(await claimWeeklyGoal("2026-11-11")).toBe(true);
    expect(await claimWeeklyGoal("2026-11-11")).toBe(false);
    expect((await getProfile())!.totalXp).toBe(before + 500);
  });
});
