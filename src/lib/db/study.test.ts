import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { HomeStudyDB, getDB, setDB } from "./index";
import { completeOnboarding, getProfile } from "./profile";
import {
  addCard,
  addDeck,
  addTask,
  addWrongAnswer,
  carryOverToToday,
  claimQuest,
  createExam,
  dailyStats,
  deleteExam,
  dueCards,
  dueWrongAnswers,
  recordStudySession,
  replanExam,
  retryWrongAnswer,
  reviewCard,
  setTaskDone,
} from "./study";

let n = 0;
beforeEach(async () => {
  setDB(new HomeStudyDB(`study-${n++}`));
  await completeOnboarding({ nickname: "a", grade: "h1", goal: "", petSpecies: "cloud", petName: "b" });
});

const TODAY = "2026-11-09";
const at = (date: string, h = 12) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, h).getTime();
};

describe("tasks", () => {
  it("grants xp once and schedules spaced reviews for unit tasks", async () => {
    const t = await addTask({ date: TODAY, title: "다항식", unit: "다항식의 연산" });
    await setTaskDone(t.id, true, at(TODAY));
    await setTaskDone(t.id, false, at(TODAY));
    await setTaskDone(t.id, true, at(TODAY));
    expect((await getProfile())?.totalXp).toBe(10);
    const spaced = await getDB().tasks.filter((x) => x.kind === "spaced").toArray();
    expect(spaced.map((s) => s.date).sort()).toEqual(["2026-11-10", "2026-11-12", "2026-11-16", "2026-11-23"]);
  });

  it("does not schedule reviews for plain tasks", async () => {
    const t = await addTask({ date: TODAY, title: "숙제" });
    await setTaskDone(t.id, true, at(TODAY));
    expect(await getDB().tasks.count()).toBe(1);
  });

  it("carries over past undone tasks", async () => {
    await addTask({ date: "2026-11-07", title: "a" });
    const done = await addTask({ date: "2026-11-08", title: "b" });
    await setTaskDone(done.id, true);
    expect(await carryOverToToday(TODAY)).toBe(1);
    expect((await getDB().tasks.where("date").equals(TODAY).toArray()).map((t) => t.title)).toEqual(["a"]);
  });
});

describe("exams", () => {
  it("creates a plan, replans remaining units, and deletes undone tasks", async () => {
    const [math] = await getDB().subjects.filter((s) => s.group === "math").toArray();
    const { exam } = await createExam(
      { title: "기말", date: "2026-11-20", ranges: [{ subjectId: math.id, units: ["a", "b", "c"] }], minutesPerDay: 60, restDays: [] },
      TODAY,
    );
    const tasks = await getDB().tasks.where("examId").equals(exam.id).toArray();
    const learnA = tasks.find((t) => t.unit === "a")!;
    await setTaskDone(learnA.id, true, at(TODAY));

    const plan = await replanExam(exam.id, "2026-11-10");
    expect(plan.tasks.filter((t) => t.kind === "learn").map((t) => t.unit)).toEqual(["b", "c"]);
    const after = await getDB().tasks.where("examId").equals(exam.id).toArray();
    expect(after.filter((t) => t.kind === "learn").map((t) => t.unit).sort()).toEqual(["a", "b", "c"]);
    expect(after.some((t) => t.kind === "spaced")).toBe(true);

    await deleteExam(exam.id);
    expect(await getDB().exams.count()).toBe(0);
    const left = await getDB().tasks.toArray();
    expect(left.every((t) => t.done || t.kind === "spaced")).toBe(true);
  });
});

describe("sessions, cards, wrong answers, quests", () => {
  it("records focus minutes as xp and quest progress", async () => {
    const start = at(TODAY, 9);
    await recordStudySession({ startedAt: start, endedAt: start + 26 * 60_000, focusMinutes: 26.7, mode: "pomodoro" });
    await recordStudySession({ startedAt: start, endedAt: start + 20_000, focusMinutes: 0.3, mode: "free" });
    expect((await getProfile())?.totalXp).toBe(26);
    expect((await dailyStats(TODAY)).focusMinutes).toBe(26);
  });

  it("reviews cards and moves them out of today's queue", async () => {
    const deck = await addDeck("영단어");
    const card = await addCard(deck.id, "apple", "사과");
    expect(await dueCards()).toHaveLength(1);
    await reviewCard(card.id, 3);
    expect(await dueCards()).toHaveLength(0);
    expect((await getProfile())?.totalXp).toBe(2);
  });

  it("retries wrong answers on schedule", async () => {
    const w = await addWrongAnswer({ question: "q", myAnswer: "1", correctAnswer: "2", reason: "mistake" }, new Blob(["x"]), TODAY);
    expect(await getDB().images.count()).toBe(1);
    expect(await dueWrongAnswers(TODAY)).toHaveLength(0);
    expect(await dueWrongAnswers("2026-11-10")).toHaveLength(1);
    await retryWrongAnswer(w.id, true, at("2026-11-10"));
    expect((await getDB().wrongAnswers.get(w.id))?.nextRetry).toBe("2026-11-13");
  });

  it("claims a quest only once and only when complete", async () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(await claimQuest("wrong1", key)).toBe(false);
    const w = await addWrongAnswer({ question: "q", myAnswer: "1", correctAnswer: "2", reason: "concept" });
    await retryWrongAnswer(w.id, false);
    expect(await claimQuest("wrong1", key)).toBe(true);
    expect(await claimQuest("wrong1", key)).toBe(false);
    expect((await getProfile())?.totalXp).toBe(5 + 15);
  });
});

describe("migration v1 → v2", () => {
  it("fills subject course links from the profile grade", async () => {
    const name = `mig-${n++}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ profile: "id", subjects: "id, group", tasks: "id, date, subjectId, examId, [date+order]" });
    await v1.table("profile").put({ id: "me", grade: "h1" });
    await v1.table("subjects").put({ id: "s1", name: "수학", group: "math", color: "#f2a93b" });
    await v1.table("tasks").put({ id: "t1", date: TODAY, title: "x", done: false, order: 1 });
    v1.close();

    const v2 = new HomeStudyDB(name);
    const s = await v2.subjects.get("s1");
    expect(s?.courseIds).toEqual(["h1-math-1", "h1-math-2"]);
    expect(s?.customUnits).toEqual([]);
    expect(s?.color).toBe("#d4881c");
    expect((await v2.tasks.get("t1"))?.kind).toBe("custom");
  });
});

describe("timer records", () => {
  it("saves a focus session once per id", async () => {
    const start = at(TODAY, 9);
    const input = { startedAt: start, endedAt: start + 25 * 60_000, focusMinutes: 25, mode: "pomodoro" as const };
    expect(await recordStudySession(input, "timer-1")).not.toBeNull();
    expect(await recordStudySession(input, "timer-1")).toBeNull();
    expect(await getDB().studySessions.count()).toBe(1);
    expect((await getProfile())?.totalXp).toBe(25);
  });
});
