import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { HomeStudyDB, getDB, setDB } from "./index";
import { completeOnboarding, getProfile, updateProfile } from "./profile";
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
  updateExam,
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
    expect((await getProfile())?.totalXp).toBe(100);
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
  it("edits an exam: a rename keeps tasks, a new date replans the rest", async () => {
    const [math] = await getDB().subjects.filter((s) => s.group === "math").toArray();
    const { exam } = await createExam(
      { title: "기말", date: "2026-11-20", ranges: [{ subjectId: math.id, units: ["a", "b", "c"] }], minutesPerDay: 60, restDays: [] },
      TODAY,
    );
    const ids = (await getDB().tasks.where("examId").equals(exam.id).toArray()).map((t) => t.id).sort();
    const r1 = await updateExam(exam.id, { title: " 기말고사 " }, TODAY);
    expect(r1.replanned).toBe(false);
    expect((await getDB().exams.get(exam.id))?.title).toBe("기말고사");
    expect((await getDB().tasks.where("examId").equals(exam.id).toArray()).map((t) => t.id).sort()).toEqual(ids);

    const r2 = await updateExam(exam.id, { date: "2026-11-25", restDays: [0] }, TODAY);
    expect(r2.replanned).toBe(true);
    const after = await getDB().tasks.where("examId").equals(exam.id).toArray();
    expect(after.some((t) => t.date > "2026-11-20")).toBe(true);
    expect(after.some((t) => new Date(`${t.date}T12:00:00`).getDay() === 0 && t.kind !== "spaced")).toBe(false);
    expect((await getDB().exams.get(exam.id))?.date).toBe("2026-11-25");
  });

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
    expect((await getProfile())?.totalXp).toBe(260);
    expect((await dailyStats(TODAY)).focusMinutes).toBe(26);
  });

  it("hides new cards over the daily limit but keeps cards already started", async () => {
    const deck = await addDeck("단어");
    for (let i = 0; i < 5; i++) await addCard(deck.id, `q${i}`, `a${i}`);
    await updateProfile({ newCardLimit: 2 });
    const first = (await dueCards())[0];
    expect(await dueCards()).toHaveLength(2);
    await reviewCard(first.id, 3);
    expect(await dueCards()).toHaveLength(1); // 상한 2 중 1장 사용 → 새 카드 1장 남음
    expect((await getProfile())?.newCardsToday?.count).toBe(1);
    await updateProfile({ newCardLimit: 1 });
    expect(await dueCards()).toHaveLength(0);
  });

  it("reviews cards and moves them out of today's queue", async () => {
    const deck = await addDeck("영단어");
    const card = await addCard(deck.id, "apple", "사과");
    expect(await dueCards()).toHaveLength(1);
    await reviewCard(card.id, 3);
    expect(await dueCards()).toHaveLength(0);
    expect((await getProfile())?.totalXp).toBe(20);
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
    expect((await getProfile())?.totalXp).toBe(50 + 150);
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
    expect((await getProfile())?.totalXp).toBe(250);
  });
});

describe("backup with photos and old formats", () => {
  it("round-trips images", async () => {
    const { exportBackup, importBackup } = await import("./backup");
    const w = await addWrongAnswer({ question: "q", myAnswer: "1", correctAnswer: "2", reason: "mistake" }, new Blob(["hello"], { type: "image/jpeg" }), TODAY);
    const json = await exportBackup();
    setDB(new HomeStudyDB(`study-${n++}`));
    await importBackup(json);
    const restored = await getDB().images.get(w.imageId!);
    expect(restored?.blob.type).toBe("image/jpeg");
    expect(await restored!.blob.text()).toBe("hello");
  });

  it("upgrades a stage-0 style backup and drops dangling photo links", async () => {
    const { importBackup } = await import("./backup");
    const old = {
      app: "homestudy",
      version: 1,
      tables: {
        profile: [{ id: "me", grade: "h1", nickname: "a", pet: { species: "cloud", name: "b" }, totalXp: 0, coins: 0, theme: "system" }],
        subjects: [{ id: "s1", name: "수학", group: "math", color: "#f2a93b" }],
        tasks: [{ id: "t1", date: TODAY, title: "x", done: false, order: 1 }],
        images: [{ id: "i1", createdAt: 1 }],
        wrongAnswers: [{ id: "w1", question: "q", myAnswer: "", correctAnswer: "a", reason: "concept", nextRetry: TODAY, imageId: "i1" }],
      },
    };
    await importBackup(JSON.stringify(old));
    const db = getDB();
    expect((await db.subjects.get("s1"))?.courseIds).toEqual(["h1-math-1", "h1-math-2"]);
    expect((await db.tasks.get("t1"))?.kind).toBe("custom");
    expect(await db.images.count()).toBe(0);
    const w = await db.wrongAnswers.get("w1");
    expect(w).toMatchObject({ streak: 0, mastered: false, retries: [] });
    expect(w?.imageId).toBeUndefined();
  });

  it("rejects unreadable files", async () => {
    const { importBackup } = await import("./backup");
    await expect(importBackup("not json")).rejects.toThrow("읽을 수 없어요");
  });
});

describe("exam goals and results", () => {
  it("saves goals/results, grants xp once, and builds a trend", async () => {
    const { examTrend, goalsMet } = await import("@/lib/study/examTrend");
    const { setExamGoals, saveExamResult, examsAwaitingResult } = await import("./study");
    const subjects = await getDB().subjects.toArray();
    const math = subjects.find((s) => s.group === "math")!;
    const eng = subjects.find((s) => s.group === "english")!;
    const mk = async (title: string, date: string) =>
      (await createExam({ title, date, ranges: [{ subjectId: math.id, units: ["a"] }, { subjectId: eng.id, units: ["b"] }], minutesPerDay: 60, restDays: [] }, "2026-09-01")).exam;
    const mid = await mk("중간", "2026-10-10");
    const fin = await mk("기말", "2026-11-08");

    await setExamGoals(fin.id, { [math.id]: 85, [eng.id]: undefined });
    expect((await getDB().exams.get(fin.id))?.goals).toEqual({ [math.id]: 85 });
    expect((await examsAwaitingResult("2026-11-09")).map((e) => e.title)).toEqual(["기말"]);

    expect(await saveExamResult(mid.id, { [math.id]: 70, [eng.id]: 80 }, { worked: "", change: "" })).toBe(300);
    expect(await saveExamResult(fin.id, { [math.id]: 88.4, [eng.id]: 140 }, { worked: " 백지 복습 ", change: "" })).toBe(300);
    expect(await saveExamResult(fin.id, { [math.id]: 90 }, { worked: "", change: "" })).toBe(0); // 고쳐도 한 번만
    expect(await saveExamResult(fin.id, {}, { worked: "", change: "" })).toBe(0);
    expect(await examsAwaitingResult("2026-11-09")).toEqual([]);

    const exams = await getDB().exams.toArray();
    const trend = examTrend(exams);
    const m = trend.find((t) => t.subjectId === math.id)!;
    expect(m.points.map((p) => p.score)).toEqual([70, 90]);
    expect(m.change).toBe(20);
    expect(m.points[1].goal).toBe(85);
    expect(goalsMet(exams.find((e) => e.id === fin.id)!)).toEqual({ met: 1, total: 1 });
    // 영어는 두 번째 저장에서 빠졌다
    expect(trend.find((t) => t.subjectId === eng.id)?.points).toHaveLength(1);
  });
});

describe("maintenance and edits", () => {
  it("adds focus time to the linked task", async () => {
    const t = await addTask({ date: TODAY, title: "수학" });
    const start = at(TODAY, 9);
    await recordStudySession({ startedAt: start, endedAt: start + 25 * 60_000, focusMinutes: 25, mode: "pomodoro", taskId: t.id }, "s-a");
    await recordStudySession({ startedAt: start + 1, endedAt: start + 10 * 60_000, focusMinutes: 10, mode: "pomodoro", taskId: t.id }, "s-b");
    await recordStudySession({ startedAt: start, endedAt: start + 25 * 60_000, focusMinutes: 25, mode: "pomodoro", taskId: t.id }, "s-a"); // 중복
    expect((await getDB().tasks.get(t.id))?.actualMinutes).toBe(35);
  });

  it("prunes spaced reviews overdue by more than two weeks only", async () => {
    const { pruneStaleReviews } = await import("./study");
    const t = await addTask({ date: "2026-10-01", title: "단원", unit: "u" });
    await setTaskDone(t.id, true, at("2026-10-01")); // 복습: 10/2, 10/4, 10/8, 10/15
    await addTask({ date: "2026-10-01", title: "내 할 일" });
    expect(await pruneStaleReviews("2026-10-20")).toBe(2); // 10/2, 10/4만 (10/6 이전)
    const left = (await getDB().tasks.filter((x) => x.kind === "spaced").toArray()).map((x) => x.date).sort();
    expect(left).toEqual(["2026-10-08", "2026-10-15"]);
    expect(await getDB().tasks.filter((x) => x.title === "내 할 일").count()).toBe(1);
  });

  it("relinks subjects when the grade changes and keeps custom units", async () => {
    const { relinkSubjectsToGrade, updateSubject } = await import("./study");
    const math = (await getDB().subjects.toArray()).find((s) => s.group === "math")!;
    await updateSubject(math.id, { customUnits: ["내 단원"] });
    await relinkSubjectsToGrade("m2");
    const after = await getDB().subjects.get(math.id);
    expect(after?.courseIds).toEqual(["m2-math-1"]);
    expect(after?.customUnits).toEqual(["내 단원"]);
  });
});
