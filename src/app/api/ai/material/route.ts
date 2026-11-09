import { NextResponse } from "next/server";
import { getModel } from "@/lib/ai/provider";
import { friendlyAiError, parseBody, withQuota } from "@/lib/ai/route-helpers";
import { MaterialRequestSchema } from "@/lib/ai/schemas";
import { makeMaterial } from "@/lib/ai/service";

export async function POST(request: Request) {
  const body = await parseBody(request, MaterialRequestSchema);
  if (body instanceof Response) return body;
  let ai: ReturnType<typeof getModel>;
  try {
    ai = getModel();
  } catch (e) {
    return friendlyAiError(e);
  }
  return withQuota("material", async () => NextResponse.json(await makeMaterial(body, ai.model, ai.webSearch)));
}
