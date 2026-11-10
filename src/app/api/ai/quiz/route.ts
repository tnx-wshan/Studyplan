import { NextResponse } from "next/server";
import { getModel } from "@/lib/ai/provider";
import { friendlyAiError, parseBody, withQuota } from "@/lib/ai/route-helpers";
import { QuizRequestSchema } from "@/lib/ai/schemas";
import { makeQuiz } from "@/lib/ai/service";

export async function POST(request: Request) {
  const body = await parseBody(request, QuizRequestSchema);
  if (body instanceof Response) return body;
  let ai: ReturnType<typeof getModel>;
  try {
    ai = getModel();
  } catch (e) {
    return friendlyAiError(e);
  }
  return withQuota("quiz", async () => {
    const quiz = await makeQuiz(body, ai.models);
    if (quiz.questions.length === 0) throw new Error("no usable questions");
    return NextResponse.json(quiz);
  });
}
