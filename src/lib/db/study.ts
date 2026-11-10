import { getDB, newId } from "./index";
import { addXpInTx } from "./profile";
import type { Card, Exam, StudySession, Subject, Task, WrongAnswer } from "./types";
import { addDays, toDateKey } from "@/lib/date";
import { XP_REWARDS } from "@/lib/game/level";
import { DAILY_QUESTS, type DailyStats } from "@/lib/game/quests";
import { generateExamPlan, type TaskDraft } from "@/lib/study/examPlan";
import { nextRetryAfter, SPACED_STEPS } from "@/lib/study/retry";
import { clampScore } from "@/lib/study/examTrend";
import { newSrs, review, type Rating } from "@/lib/study/srs";

const now = () => Date.now();

// ───────── 할 일 ─────────

async function nextOrder(date: string) {
  const last = await getDB().tasks.where("[date+order]").between([date, -Infinity], [date, Infinity]).last();
  return (last?.order ?? 0) + 1;
}

export async function addTask(input: { date: string; title: string; subjectId?: string; unit?: string; estimatedMinutes?: number }) {
  const t = now();
  const task: Task = {
    id: newId(),
    kind: "custom",
    done: false,
    order: await nextOrder(input.date),
    createdAt: t,
    updatedAt: t,
    ...input,
    title: input.title.trim(),
  };
  await getDB().tasks.add(task);
  return task;
}

/**
 * 완료 체크. 처음 완료할 때만 경험치를 주고,
 * 단원을 공부한 할 일이면 1·3·7·14일 뒤 간격 복습 할 일을 만든다.
 */
export async function setTaskDone(id: string, done: boolean, at = now()) {
  const db = getDB();
  await db.transaction("rw", db.tasks, db.profile, db.xpEvents, async () => {
    const task = await db.tasks.get(id);
    if (!task) return;
    await db.tasks.update(id, { done, doneAt: done ? at : undefined, updatedAt: at, ...(done ? { xpGranted: true } : {}) });
    if (!done || task.xpGranted) return;
    await addXpInTx(db, XP_REWARDS.taskDone, "task", at);
    if (task.unit && (task.kind === "learn" || task.kind === "custom")) {
      const today = toDateKey(new Date(at));
      for (const [i, step] of SPACED_STEPS.entries()) {
        const date = addDays(today, step);
        await db.tasks.add({
          id: newId(),
          date,
          subjectId: task.subjectId,
          title: `${task.unit} (${step}일 뒤 복습)`,
          kind: "spaced",
          unit: task.unit,
          spacedStep: i + 1,
          estimatedMinutes: 15,
          done: false,
          order: 1000 + i,
          examId: task.examId,
          createdAt: at,
          updatedAt: at,
        });
      }
    }
  });
}

/** 기억 지도에서: 단원 복습을 오늘 할 일로 넣는다 (이미 있으면 넣지 않는다) */
export async function addReviewTask(subjectId: string, unit: string, date = toDateKey()) {
  const db = getDB();
  const exists = await db.tasks.where("date").equals(date).filter((t) => !t.done && t.kind === "spaced" && t.subjectId === subjectId && t.unit === unit).count();
  if (exists) return false;
  const t = now();
  await db.tasks.add({ id: newId(), date, subjectId, title: `${unit} (기억 지도 복습)`, kind: "spaced", unit, estimatedMinutes: 15, done: false, order: await nextOrder(date), createdAt: t, updatedAt: t });
  return true;
}

export async function updateTask(id: string, patch: Partial<Pick<Task, "title" | "date" | "subjectId" | "estimatedMinutes">>) {
  await getDB().tasks.update(id, { ...patch, updatedAt: now() });
}

export async function deleteTask(id: string) {
  await getDB().tasks.delete(id);
}

export async function pastUndoneTasks(today = toDateKey()) {
  return getDB()
    .tasks.where("date")
    .below(today)
    .filter((t) => !t.done)
    .toArray();
}

/** 지난 날의 끝내지 못한 할 일을 오늘로 옮긴다 */
export async function carryOverToToday(today = toDateKey()) {
  const db = getDB();
  const tasks = await pastUndoneTasks(today);
  let order = await nextOrder(today);
  await db.transaction("rw", db.tasks, async () => {
    for (const t of tasks) await db.tasks.update(t.id, { date: today, order: order++, updatedAt: now() });
  });
  return tasks.length;
}

// ───────── 시험 ─────────

function draftsToTasks(drafts: TaskDraft[], examId: string): Task[] {
  const t = now();
  const orders = new Map<string, number>();
  return drafts.map((d) => {
    const order = (orders.get(d.date) ?? 0) + 1;
    orders.set(d.date, order);
    return { id: newId(), ...d, examId, done: false, order: 100 + order, createdAt: t, updatedAt: t };
  });
}

export type ExamInput = Pick<Exam, "title" | "date" | "ranges" | "minutesPerDay" | "restDays">;

export async function createExam(input: ExamInput, today = toDateKey()) {
  const db = getDB();
  const t = now();
  const exam: Exam = { id: newId(), ...input, title: input.title.trim(), createdAt: t, updatedAt: t };
  const plan = generateExamPlan({ ...input, startDate: today, examDate: input.date });
  await db.transaction("rw", db.exams, db.tasks, async () => {
    await db.exams.add(exam);
    await db.tasks.bulkAdd(draftsToTasks(plan.tasks, exam.id));
  });
  return { exam, plan };
}

/**
 * 계획 다시 짜기: 끝낸 단원은 빼고, 남은 단원으로 오늘부터 시험 전날까지 다시 배분한다.
 * 끝낸 할 일과 간격 복습 할 일은 그대로 둔다.
 */
export async function replanExam(examId: string, today = toDateKey()) {
  const db = getDB();
  const exam = await db.exams.get(examId);
  if (!exam) throw new Error("exam not found");
  const tasks = await db.tasks.where("examId").equals(examId).toArray();
  const doneUnits = new Set(tasks.filter((t) => t.kind === "learn" && t.done).map((t) => `${t.subjectId}::${t.unit}`));
  const ranges = exam.ranges.map((r) => ({ ...r, units: r.units.filter((u) => !doneUnits.has(`${r.subjectId}::${u}`)) }));
  const plan = generateExamPlan({ ...exam, ranges, startDate: today, examDate: exam.date });
  const removable = tasks.filter((t) => !t.done && t.kind !== "spaced").map((t) => t.id);
  await db.transaction("rw", db.tasks, db.exams, async () => {
    await db.tasks.bulkDelete(removable);
    await db.tasks.bulkAdd(draftsToTasks(plan.tasks, examId));
    await db.exams.update(examId, { updatedAt: now() });
  });
  return plan;
}

/** 시험 삭제: 끝내지 않은 할 일은 지우고, 끝낸 기록은 통계를 위해 남긴다 */
export async function deleteExam(examId: string) {
  const db = getDB();
  await db.transaction("rw", db.tasks, db.exams, async () => {
    const tasks = await db.tasks.where("examId").equals(examId).toArray();
    await db.tasks.bulkDelete(tasks.filter((t) => !t.done).map((t) => t.id));
    await db.tasks.bulkUpdate(tasks.filter((t) => t.done).map((t) => ({ key: t.id, changes: { examId: undefined } })));
    await db.exams.delete(examId);
  });
}

/** 시험 전 목표 점수 저장 (빈 값은 목표 없음) */
export async function setExamGoals(examId: string, goals: Record<string, number | undefined>) {
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(goals)) if (v !== undefined && Number.isFinite(v)) clean[k] = clampScore(v);
  await getDB().exams.update(examId, { goals: clean, updatedAt: now() });
}

/** 시험 결과와 돌아보기 저장. 처음 기록할 때만 경험치를 준다. */
export async function saveExamResult(examId: string, results: Record<string, number | undefined>, note: { worked: string; change: string }, at = now()) {
  const db = getDB();
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(results)) if (v !== undefined && Number.isFinite(v)) clean[k] = clampScore(v);
  if (Object.keys(clean).length === 0) return 0;
  return db.transaction("rw", db.exams, db.profile, db.xpEvents, async () => {
    const exam = await db.exams.get(examId);
    if (!exam) return 0;
    const grant = !exam.resultXpGranted;
    await db.exams.update(examId, { results: clean, resultNote: { worked: note.worked.trim(), change: note.change.trim() }, resultAt: at, resultXpGranted: true, updatedAt: at });
    if (grant) await addXpInTx(db, XP_REWARDS.examResult, "exam", at);
    return grant ? XP_REWARDS.examResult : 0;
  });
}

/** 끝났지만(오늘 포함) 아직 결과를 기록하지 않은 최근 시험 */
export async function examsAwaitingResult(today = toDateKey(), withinDays = 21) {
  const from = addDays(today, -withinDays);
  return (await getDB().exams.where("date").between(from, today, true, true).toArray()).filter((e) => !e.results);
}

// ───────── 집중 기록 ─────────

/** 집중 기록 저장. id를 주면 이미 저장된 기록은 다시 저장하지 않는다(null 반환). */
export async function recordStudySession(input: Omit<StudySession, "id" | "createdAt" | "updatedAt" | "date">, id: string = newId()) {
  const db = getDB();
  const minutes = Math.floor(input.focusMinutes);
  if (minutes < 1) return null;
  const session: StudySession = {
    id,
    ...input,
    focusMinutes: minutes,
    date: toDateKey(new Date(input.startedAt)),
    createdAt: input.endedAt,
    updatedAt: input.endedAt,
  };
  return db.transaction("rw", db.studySessions, db.profile, db.xpEvents, async () => {
    if (await db.studySessions.get(id)) return null;
    await db.studySessions.add(session);
    await addXpInTx(db, minutes * XP_REWARDS.studyMinute, "focus", input.endedAt);
    return session;
  });
}

// ───────── 플래시카드 ─────────

export async function addDeck(name: string, subjectId?: string) {
  const t = now();
  const deck = { id: newId(), name: name.trim(), subjectId, createdAt: t, updatedAt: t };
  await getDB().decks.add(deck);
  return deck;
}

export async function renameDeck(id: string, name: string) {
  await getDB().decks.update(id, { name: name.trim(), updatedAt: now() });
}

export async function deleteDeck(id: string) {
  const db = getDB();
  await db.transaction("rw", db.decks, db.cards, async () => {
    await db.cards.where("deckId").equals(id).delete();
    await db.decks.delete(id);
  });
}

export async function addCard(deckId: string, front: string, back: string) {
  const t = now();
  const card: Card = { id: newId(), deckId, front: front.trim(), back: back.trim(), due: t, srs: newSrs(), createdAt: t, updatedAt: t };
  await getDB().cards.add(card);
  return card;
}

export async function updateCard(id: string, front: string, back: string) {
  await getDB().cards.update(id, { front: front.trim(), back: back.trim(), updatedAt: now() });
}

export async function deleteCard(id: string) {
  await getDB().cards.delete(id);
}

export async function dueCards(deckId?: string, at = now()) {
  const db = getDB();
  const due = await db.cards.where("due").belowOrEqual(at).sortBy("due");
  return deckId ? due.filter((c) => c.deckId === deckId) : due;
}

export async function reviewCard(id: string, rating: Rating, at = now()) {
  const db = getDB();
  await db.transaction("rw", db.cards, db.profile, db.xpEvents, async () => {
    const card = await db.cards.get(id);
    if (!card) return;
    const r = review(card.srs, rating, at);
    await db.cards.update(id, { srs: r.srs, due: r.due, updatedAt: at });
    await addXpInTx(db, XP_REWARDS.cardReviewed, "card", at);
  });
}

// ───────── 오답노트 ─────────

export type WrongInput = Pick<WrongAnswer, "question" | "myAnswer" | "correctAnswer" | "reason" | "note" | "subjectId" | "unitId">;

export async function addWrongAnswer(input: WrongInput, image?: Blob, today = toDateKey()) {
  const db = getDB();
  const t = now();
  const imageId = image ? newId() : undefined;
  const item: WrongAnswer = {
    id: newId(),
    ...input,
    imageId,
    nextRetry: addDays(today, 1),
    streak: 0,
    mastered: false,
    retries: [],
    createdAt: t,
    updatedAt: t,
  };
  await db.transaction("rw", db.wrongAnswers, db.images, async () => {
    if (image && imageId) await db.images.add({ id: imageId, blob: image, createdAt: t });
    await db.wrongAnswers.add(item);
  });
  return item;
}

export async function updateWrongAnswer(id: string, patch: Partial<WrongInput>) {
  await getDB().wrongAnswers.update(id, { ...patch, updatedAt: now() });
}

export async function retryWrongAnswer(id: string, correct: boolean, at = now()) {
  const db = getDB();
  await db.transaction("rw", db.wrongAnswers, db.profile, db.xpEvents, async () => {
    const w = await db.wrongAnswers.get(id);
    if (!w) return;
    const next = nextRetryAfter(w, correct, toDateKey(new Date(at)));
    await db.wrongAnswers.update(id, { ...next, retries: [...w.retries, { at, correct }], updatedAt: at });
    await addXpInTx(db, XP_REWARDS.wrongAnswerRetried, "wrong", at);
  });
}

export async function deleteWrongAnswer(id: string) {
  const db = getDB();
  await db.transaction("rw", db.wrongAnswers, db.images, async () => {
    const w = await db.wrongAnswers.get(id);
    if (w?.imageId) await db.images.delete(w.imageId);
    await db.wrongAnswers.delete(id);
  });
}

export async function dueWrongAnswers(today = toDateKey()) {
  return getDB()
    .wrongAnswers.where("nextRetry")
    .belowOrEqual(today)
    .filter((w) => !w.mastered)
    .toArray();
}

// ───────── 과목 ─────────

export async function updateSubject(id: string, patch: Partial<Pick<Subject, "name" | "color" | "courseIds" | "customUnits" | "archived">>) {
  await getDB().subjects.update(id, { ...patch, updatedAt: now() });
}

export async function addSubject(input: Pick<Subject, "name" | "group" | "color">) {
  const t = now();
  const s: Subject = { id: newId(), ...input, name: input.name.trim(), courseIds: [], customUnits: [], createdAt: t, updatedAt: t };
  await getDB().subjects.add(s);
  return s;
}

// ───────── 퀘스트 ─────────

export async function dailyStats(date = toDateKey()): Promise<DailyStats> {
  const db = getDB();
  const [sessions, events, tasks] = await Promise.all([
    db.studySessions.where("date").equals(date).toArray(),
    db.xpEvents.where("date").equals(date).toArray(),
    db.tasks.filter((t) => t.done && !!t.doneAt && toDateKey(new Date(t.doneAt)) === date).count(),
  ]);
  return {
    focusMinutes: sessions.reduce((s, x) => s + x.focusMinutes, 0),
    tasksDone: tasks,
    cardsReviewed: events.filter((e) => e.reason === "card").length,
    wrongRetried: events.filter((e) => e.reason === "wrong").length,
  };
}

/** 퀘스트 보상 받기. 목표를 채웠고 아직 받지 않았을 때만 지급한다. */
export async function claimQuest(questId: string, date = toDateKey(), at = now()) {
  const def = DAILY_QUESTS.find((q) => q.id === questId);
  if (!def) throw new Error("unknown quest");
  const stats = await dailyStats(date);
  if (stats[def.stat] < def.target) return false;
  const db = getDB();
  const id = `${questId}:${date}`;
  return db.transaction("rw", db.userQuests, db.profile, db.xpEvents, async () => {
    if (await db.userQuests.get(id)) return false;
    await db.userQuests.add({ id, questId, period: date, progress: def.target, completedAt: at, createdAt: at, updatedAt: at });
    await addXpInTx(db, def.reward, `quest:${questId}`, at);
    return true;
  });
}
