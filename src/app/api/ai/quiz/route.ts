import { NextResponse } from "next/server";
import { getModel } from "@/lib/ai/provider";
import { friendlyAiError, parseBody, withQuota } from "@/lib/ai/route-helpers";
import { QuizRequestSchema } from "@/lib/ai/schemas";
import { makeQuiz } from "@/lib/ai/service";
import { addItem, findByKey, getItem, gradeId, markUsed, quizLookupKey, subjectId, type QuizData } from "@/lib/server/bank";
import { rejectIfSuspended } from "@/lib/server/guard";
import { currentUserId } from "@/lib/server/identity";

export async function POST(request: Request) {
  const body = await parseBody(request, QuizRequestSchema);
  if (body instanceof Response) return body;
  const blocked = await rejectIfSuspended();
  if (blocked) return blocked;

  // 같은 자료로 같은 조건의 문제를 이미 만들었으면 그대로 준다
  const lookupKey = quizLookupKey(body);
  const saved = findByKey(lookupKey);
  if (saved) {
    markUsed(saved.id);
    const data = saved.data as QuizData;
    return NextResponse.json({ title: saved.title, questions: data.questions, verified: data.verified, bankId: saved.id, fromBank: true });
  }

  let ai: ReturnType<typeof getModel>;
  try {
    ai = getModel();
  } catch (e) {
    return friendlyAiError(e);
  }
  return withQuota("quiz", async () => {
    const quiz = await makeQuiz(body, ai.models);
    if (quiz.questions.length === 0) throw new Error("no usable questions");
    const parent = body.bankMaterialId ? getItem(body.bankMaterialId) : null;
    const item = addItem({
      kind: "quiz",
      lookupKey,
      sourceKind: "quiz",
      grade: parent?.grade ?? gradeId(body.grade),
      subject: parent?.subject ?? subjectId(body.subjectGroup, body.subject),
      subjectName: parent?.subjectName ?? body.subject ?? "",
      topic: parent?.topic ?? quiz.title,
      title: quiz.title,
      data: { questions: quiz.questions, verified: quiz.verified, difficulty: body.difficulty },
      parentId: parent?.id ?? null,
      createdBy: await currentUserId(),
      madeBy: ai.setup.provider,
    });
    return NextResponse.json({ ...quiz, bankId: item.id });
  });
}
