import { NextResponse } from "next/server";
import { getModel } from "@/lib/ai/provider";
import { friendlyAiError, parseBody, withQuota } from "@/lib/ai/route-helpers";
import { FeedbackRequestSchema } from "@/lib/ai/schemas";
import { makeFeedback } from "@/lib/ai/service";

export async function POST(request: Request) {
  const body = await parseBody(request, FeedbackRequestSchema);
  if (body instanceof Response) return body;
  let ai: ReturnType<typeof getModel>;
  try {
    ai = getModel();
  } catch (e) {
    return friendlyAiError(e);
  }
  return withQuota("coach", async () => NextResponse.json(await makeFeedback(body, ai.models)));
}
