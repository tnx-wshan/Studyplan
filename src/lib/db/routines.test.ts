import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { HomeStudyDB, getDB, setDB } from "./index";
import { completeOnboarding } from "./profile";
import { addRoutine, deleteRoutine, generateRoutineTasks, routineDates, routinesForReminders, updateRoutine } from "./routines";
import { setTaskDone } from "./study";

let n = 0;
beforeEach(async () => {
  setDB(new HomeStudyDB(`routine-${n++}`));
  await completeOnboarding({ nickname: "a", grade: "h1", goal: "", petSpecies: "cloud", petName: "b" });
});

const MON = "2026-11-09"; // 월요일
const WEEKDAYS = [1, 2, 3, 4, 5];
const dates = async () => (await getDB().tasks.orderBy("date").toArray()).filter((t) => t.routineId).map((t) => t.date);

describe("routines", () => {
  it("picks dates by weekday", () => {
    expect(routineDates([1, 3], MON, "2026-11-15")).toEqual(["2026-11-09", "2026-11-11"]);
    expect(routineDates([], MON, "2026-11-15")).toEqual([]);
  });

  it("creates a week of tasks and extends day by day without duplicates", async () => {
    await addRoutine({ title: "수학 30분", minutes: 30, days: WEEKDAYS, time: "20:00" }, MON);
    expect(await dates()).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]);
    expect(await generateRoutineTasks(MON)).toBe(0); // 같은 날 다시 불러도 그대로
    // 다음 날 열면 하루(다음 주 월요일)가 늘어난다
    expect(await generateRoutineTasks("2026-11-10")).toBe(1);
    expect((await dates()).at(-1)).toBe("2026-11-16");
    const task = (await getDB().tasks.toArray()).find((t) => t.routineId)!;
    expect(task).toMatchObject({ title: "수학 30분", time: "20:00", estimatedMinutes: 30, kind: "custom" });
  });

  it("does not bring back a routine task the student deleted", async () => {
    await addRoutine({ title: "영단어", minutes: 10, days: [0, 1, 2, 3, 4, 5, 6] }, MON);
    const first = (await getDB().tasks.toArray()).find((t) => t.date === "2026-11-10")!;
    await getDB().tasks.delete(first.id);
    await generateRoutineTasks(MON);
    expect((await dates()).includes("2026-11-10")).toBe(false);
  });

  it("regenerates upcoming tasks on edit but keeps finished ones; pausing and deleting clear them", async () => {
    const r = await addRoutine({ title: "수학", minutes: 30, days: WEEKDAYS }, MON);
    const today = (await getDB().tasks.toArray()).find((t) => t.date === MON)!;
    await setTaskDone(today.id, true);
    await updateRoutine(r.id, { title: "수학 문제집", days: [2, 4] }, MON);
    const all = (await getDB().tasks.toArray()).filter((t) => t.routineId);
    expect(all.filter((t) => t.done).map((t) => t.title)).toEqual(["수학"]);
    expect(all.filter((t) => !t.done).map((t) => `${t.date} ${t.title}`).sort()).toEqual(["2026-11-10 수학 문제집", "2026-11-12 수학 문제집"]);

    await updateRoutine(r.id, { active: false }, MON);
    expect((await getDB().tasks.toArray()).filter((t) => t.routineId && !t.done)).toEqual([]);
    await updateRoutine(r.id, { active: true }, MON);
    expect((await getDB().tasks.toArray()).filter((t) => t.routineId && !t.done)).toHaveLength(2);

    await deleteRoutine(r.id, MON);
    expect(await getDB().routines.count()).toBe(0);
    expect((await getDB().tasks.toArray()).filter((t) => t.routineId).map((t) => t.done)).toEqual([true]);
  });

  it("lists only timed, active routines for reminders", async () => {
    await addRoutine({ title: "시각 없음", minutes: 10, days: [1] }, MON);
    const r = await addRoutine({ title: "저녁 수학", minutes: 30, days: [1, 3], time: "20:00" }, MON);
    expect(await routinesForReminders()).toEqual([{ id: r.id, title: "저녁 수학", time: "20:00", days: [1, 3], minutes: 30 }]);
  });
});
