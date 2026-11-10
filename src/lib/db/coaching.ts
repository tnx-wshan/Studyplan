import { getDB, newId } from "./index";
import { addXpInTx } from "./profile";
import type { AiFeedback, CoachReport, MethodLog, Question, Reflection, StudySession, Task, XpEvent } from "./types";
import { scoreDiagnosis, type Answers } from "@/data/diagnosis";
import { toDateKey } from "@/lib/date";
import { XP_REWARDS } from "@/lib/game/level";
import type { ReportInput } from "@/lib/study/report";

const now = () => Date.now();

export async function saveDiagnosis(answers: Answers) {
  const scores = scoreDiagnosis(answers);
  await getDB().profile.update("me", { diagnosis: { answers, scores, at: now() }, updatedAt: now() });
  return scores;
}

/** 학습법 실습 기록. 같은 학습법은 하루에 한 번만 경험치를 준다. */
export async function addMethodLog(input: Pick<MethodLog, "methodId" | "subjectId" | "topic" | "fields" | "recall" | "aiFeedback">, at = now()) {
  const db = getDB();
  const date = toDateKey(new Date(at));
  const log: MethodLog = { id: newId(), date, ...input, createdAt: at, updatedAt: at };
  let xp = 0;
  await db.transaction("rw", db.methodLogs, db.profile, db.xpEvents, async () => {
    const already = await db.methodLogs.where("date").equals(date).filter((l) => l.methodId === input.methodId).count();
    await db.methodLogs.add(log);
    if (already === 0) {
      xp = XP_REWARDS.methodPractice;
      await addXpInTx(db, xp, "method", at);
    }
  });
  return { log, xp };
}

export async function setMethodLogFeedback(id: string, aiFeedback: AiFeedback) {
  await getDB().methodLogs.update(id, { aiFeedback, updatedAt: now() });
}

export async function deleteMethodLog(id: string) {
  await getDB().methodLogs.delete(id);
}

/** 주간 회고 저장. 주마다 처음 쓸 때만 경험치를 준다. */
export async function saveReflection(week: string, input: Pick<Reflection, "good" | "bad" | "nextGoal" | "mood">, at = now()) {
  const db = getDB();
  let xp = 0;
  await db.transaction("rw", db.reflections, db.profile, db.xpEvents, async () => {
    const existing = await db.reflections.get(week);
    const grant = !existing?.xpGranted;
    await db.reflections.put({
      id: week,
      week,
      good: input.good.trim(),
      bad: input.bad.trim(),
      nextGoal: input.nextGoal.trim(),
      mood: input.mood,
      xpGranted: true,
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
    });
    if (grant) {
      xp = XP_REWARDS.reflectionWritten;
      await addXpInTx(db, xp, "reflection", at);
    }
  });
  return xp;
}

export async function saveCoachReport(input: Omit<CoachReport, "id" | "createdAt" | "updatedAt">) {
  const t = now();
  const report: CoachReport = { id: newId(), ...input, createdAt: t, updatedAt: t };
  await getDB().coachReports.add(report);
  return report;
}

/**
 * 리포트 계산에 쓸 기록을 불러온다.
 * range를 주면 날짜 색인으로 그 기간의 기록만 읽어서, 기록이 많이 쌓여도 홈 화면이 느려지지 않는다.
 */
export async function loadReportInput(range?: { start: string; end: string }): Promise<ReportInput> {
  const db = getDB();
  const byDate = <T>(table: { where(index: string): { between(a: string, b: string, lo: boolean, hi: boolean): { toArray(): Promise<T[]> } }; toArray(): Promise<T[]> }) =>
    range ? table.where("date").between(range.start, range.end, true, false).toArray() : table.toArray();
  const [sessions, tasks, xpEvents, wrongAnswers, quizzes, questions, methodLogs] = await Promise.all([
    byDate<StudySession>(db.studySessions),
    byDate<Task>(db.tasks),
    byDate<XpEvent>(db.xpEvents),
    db.wrongAnswers.toArray(),
    db.quizzes.toArray(),
    range ? Promise.resolve([] as Question[]) : db.questions.toArray(),
    byDate<MethodLog>(db.methodLogs),
  ]);
  return {
    sessions,
    tasks,
    xpEvents,
    wrongAnswers,
    quizzes,
    questions: questions.map((q) => ({ quizId: q.quizId, result: q.result, updatedAt: q.updatedAt })),
    methodLogs,
  };
}
