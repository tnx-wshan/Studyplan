import { NextResponse } from "next/server";
import { getModel, PROVIDER_LABELS } from "@/lib/ai/provider";
import { friendlyAiError, parseBody, withQuota } from "@/lib/ai/route-helpers";
import { CoachRequestSchema } from "@/lib/ai/schemas";
import { makeCoaching } from "@/lib/ai/service";

export async function POST(request: Request) {
  const body = await parseBody(request, CoachRequestSchema);
  if (body instanceof Response) return body;
  let ai: ReturnType<typeof getModel>;
  try {
    ai = getModel();
  } catch (e) {
    return friendlyAiError(e);
  }
  return withQuota("coach", async () =>
    NextResponse.json({ ...(await makeCoaching(body, ai.model)), madeBy: PROVIDER_LABELS[ai.setup.provider] }),
  );
}
