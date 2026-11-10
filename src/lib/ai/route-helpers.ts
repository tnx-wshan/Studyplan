import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { AiNotConfiguredError } from "./provider";
import { consume, refund, DAILY_LIMITS, FEATURE_LABELS, type AiFeature } from "./usage";

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T | NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "요청을 읽지 못했어요. 파일이 너무 크면 줄여서 다시 시도해 주세요.");
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : jsonError(400, "요청 내용이 올바르지 않아요.");
}

/** AI 회사 쪽 오류를 학생이 이해할 수 있는 말로 */
export function friendlyAiError(e: unknown): NextResponse {
  if (e instanceof AiNotConfiguredError) return jsonError(503, `AI가 아직 설정되지 않았어요. ${e.message}`);
  const message = e instanceof Error ? e.message : String(e);
  console.error("[ai]", message);
  if (/timeout|timed out|aborted|abort/i.test(message)) return jsonError(504, "AI 응답이 너무 오래 걸려서 멈췄어요. 잠시 뒤에 다시 시도해 주세요.");
  if (/503|unavailable|overloaded|high demand/i.test(message)) return jsonError(503, "AI 서버가 지금 붐벼요. 잠시 뒤에 다시 시도해 주세요.");
  if (/api key|apikey|unauthor|permission|401|403/i.test(message)) return jsonError(502, "AI 키가 올바르지 않거나 권한이 없어요. 키를 확인해 주세요.");
  if (/quota|rate|429|resource.?exhausted/i.test(message)) return jsonError(502, "AI 회사의 사용 한도에 걸렸어요. 잠시 뒤에 다시 시도해 주세요.");
  if (/model|not found|404/i.test(message)) return jsonError(502, "설정한 AI 모델을 찾을 수 없어요. AI_MODEL 값을 확인해 주세요.");
  if (/safety|blocked/i.test(message)) return jsonError(502, "AI가 이 요청에는 답할 수 없다고 했어요. 표현을 바꿔서 다시 시도해 보세요.");
  return jsonError(502, "AI 응답을 받지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
}

/** 하루 사용량을 쓰고 AI 작업을 실행한다. 실패하면 사용량을 돌려준다. */
export async function withQuota(feature: AiFeature, run: () => Promise<Response>): Promise<Response> {
  if (!(await consume(feature))) {
    return jsonError(429, `오늘 ${FEATURE_LABELS[feature]}를 모두 썼어요 (하루 ${DAILY_LIMITS[feature]}회). 내일 다시 쓸 수 있어요.`);
  }
  try {
    return await run();
  } catch (e) {
    await refund(feature);
    return friendlyAiError(e);
  }
}
