import { getDB, newId } from "./index";
import { addXpInTx } from "./profile";
import { addCard, addDeck, addWrongAnswer } from "./study";
import type { Material, Question, Quiz, TutorChat, TutorMessage } from "./types";
import { XP_REWARDS } from "@/lib/game/level";
import { stripImages } from "@/lib/ai/text";

const now = () => Date.now();

// ───────── 튜터 대화 ─────────

export async function createChat(mode: TutorChat["mode"], subjectId?: string): Promise<TutorChat> {
  const t = now();
  const chat: TutorChat = { id: newId(), title: "새 질문", mode, subjectId, createdAt: t, updatedAt: t };
  await getDB().tutorChats.add(chat);
  return chat;
}

export async function updateChat(id: string, patch: Partial<Pick<TutorChat, "title" | "mode" | "subjectId">>) {
  await getDB().tutorChats.update(id, { ...patch, updatedAt: now() });
}

export async function deleteChat(id: string) {
  const db = getDB();
  await db.transaction("rw", db.tutorChats, db.tutorMessages, db.images, async () => {
    const msgs = await db.tutorMessages.where("chatId").equals(id).toArray();
    await db.images.bulkDelete(msgs.flatMap((m) => m.imageIds ?? []));
    await db.tutorMessages.bulkDelete(msgs.map((m) => m.id));
    await db.tutorChats.delete(id);
  });
}

/** 학생 질문 저장. 첫 질문이면 대화 제목으로 쓴다. */
export async function addUserMessage(chatId: string, content: string, images: Blob[] = []) {
  const db = getDB();
  const t = now();
  const imageIds = images.map(() => newId());
  const msg: TutorMessage = { id: newId(), chatId, role: "user", content: content.trim(), imageIds, createdAt: t, updatedAt: t };
  await db.transaction("rw", db.tutorMessages, db.tutorChats, db.images, async () => {
    await db.images.bulkAdd(images.map((blob, i) => ({ id: imageIds[i], blob, createdAt: t })));
    const count = await db.tutorMessages.where("chatId").equals(chatId).count();
    await db.tutorMessages.add(msg);
    const title = content.trim().replace(/\s+/g, " ").slice(0, 30) || "사진 질문";
    await db.tutorChats.update(chatId, { updatedAt: t, ...(count === 0 ? { title } : {}) });
  });
  return msg;
}

export async function addAssistantMessage(chatId: string, content: string, error?: string) {
  const t = now();
  const msg: TutorMessage = { id: newId(), chatId, role: "assistant", content, error, createdAt: t, updatedAt: t };
  await getDB().tutorMessages.add(msg);
  await getDB().tutorChats.update(chatId, { updatedAt: t });
  return msg;
}

export async function deleteMessage(id: string) {
  await getDB().tutorMessages.delete(id);
}

// ───────── 자료와 퀴즈 ─────────

export type MaterialInput = Pick<Material, "kind" | "title" | "summary" | "keyPoints" | "sources" | "subjectId" | "query">;

export interface QuestionInput {
  type: Question["type"];
  prompt: string;
  choices: string[];
  answer: string;
  explanation: string;
  concept: string;
}

export async function saveMaterialAndQuiz(
  material: MaterialInput,
  quiz: { title: string; difficulty: Quiz["difficulty"]; verified: boolean; madeBy: string; questions: QuestionInput[] },
) {
  const db = getDB();
  const t = now();
  const m: Material = { id: newId(), ...material, createdAt: t, updatedAt: t };
  const q: Quiz = {
    id: newId(),
    title: quiz.title,
    materialIds: [m.id],
    subjectId: material.subjectId,
    difficulty: quiz.difficulty,
    verified: quiz.verified,
    madeBy: quiz.madeBy,
    attempts: [],
    createdAt: t,
    updatedAt: t,
  };
  const questions: Question[] = quiz.questions.map((x, i) => ({ id: newId(), quizId: q.id, order: i, ...x, createdAt: t, updatedAt: t }));
  await db.transaction("rw", db.materials, db.quizzes, db.questions, async () => {
    await db.materials.add(m);
    await db.quizzes.add(q);
    await db.questions.bulkAdd(questions);
  });
  return q;
}

/** 답 기록. 처음 맞힌 문제만 경험치를 준다(다시 풀기로 경험치를 반복해서 얻지 않도록). */
export async function recordAnswer(questionId: string, userAnswer: string, result: "correct" | "wrong", at = now()) {
  const db = getDB();
  await db.transaction("rw", db.questions, db.profile, db.xpEvents, async () => {
    const q = await db.questions.get(questionId);
    if (!q) return;
    const grant = result === "correct" && !q.xpGranted;
    await db.questions.update(questionId, { userAnswer, result, updatedAt: at, ...(grant ? { xpGranted: true } : {}) });
    if (grant) await addXpInTx(db, XP_REWARDS.quizCorrect, "quiz", at);
  });
}

export async function finishQuiz(quizId: string) {
  const db = getDB();
  const questions = await db.questions.where("quizId").equals(quizId).toArray();
  const score = questions.filter((q) => q.result === "correct").length;
  const quiz = await db.quizzes.get(quizId);
  if (!quiz) return;
  await db.quizzes.update(quizId, { attempts: [...quiz.attempts, { at: now(), score, total: questions.length }], updatedAt: now() });
}

/** 다시 풀기: 이번 풀이 기록만 지운다 */
export async function resetQuiz(quizId: string) {
  const db = getDB();
  const questions = await db.questions.where("quizId").equals(quizId).toArray();
  await db.questions.bulkUpdate(questions.map((q) => ({ key: q.id, changes: { userAnswer: undefined, result: undefined } })));
}

export async function deleteQuiz(quizId: string) {
  const db = getDB();
  await db.transaction("rw", db.quizzes, db.questions, db.materials, async () => {
    const quiz = await db.quizzes.get(quizId);
    await db.questions.where("quizId").equals(quizId).delete();
    if (quiz) await db.materials.bulkDelete(quiz.materialIds);
    await db.quizzes.delete(quizId);
  });
}

export async function flagQuestion(id: string, flagged: boolean) {
  await getDB().questions.update(id, { flagged, updatedAt: now() });
}

function answerText(q: Question) {
  return q.type === "multiple" ? `${q.answer}` : q.answer;
}

export async function saveQuestionToWrong(q: Question, subjectId?: string) {
  if (q.savedToWrong) return false;
  const choices = q.choices.length ? `\n\n보기: ${q.choices.join(" / ")}` : "";
  await addWrongAnswer({
    subjectId,
    unitId: q.concept || undefined,
    question: `${q.prompt}${choices}`,
    myAnswer: q.userAnswer ?? "",
    correctAnswer: answerText(q),
    reason: "concept",
    note: q.explanation.slice(0, 200),
  });
  await getDB().questions.update(q.id, { savedToWrong: true });
  return true;
}

/** 과목별 'AI 퀴즈' 카드 묶음에 저장 */
export async function saveQuestionToCards(q: Question, subjectId?: string, subjectName?: string) {
  if (q.savedToCard) return false;
  const db = getDB();
  const name = `AI 퀴즈${subjectName ? ` · ${subjectName}` : ""}`;
  const deck = (await db.decks.filter((d) => d.name === name).first()) ?? (await addDeck(name, subjectId));
  const choices = q.choices.length ? `\n(${q.choices.join(" / ")})` : "";
  // 암기 카드는 글자만 보여주므로 그림은 "[그림]" 표시로 바꾼다
  await addCard(deck.id, stripImages(`${q.prompt}${choices}`), stripImages(`${answerText(q)}\n\n${q.explanation}`).slice(0, 500));
  await db.questions.update(q.id, { savedToCard: true });
  return true;
}
