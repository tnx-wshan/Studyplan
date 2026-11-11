import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { isAdminRequest } from "./identity";

export function adminError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/** 관리 API 공통: 관리자 확인 → 본문 읽기 → 실행. 실패하면 알기 쉬운 오류 */
export async function admin(run: () => Response | Promise<Response>): Promise<Response> {
  if (!(await isAdminRequest())) return adminError(401, "관리자 로그인이 필요해요.");
  try {
    return await run();
  } catch (e) {
    console.error("[admin]", e);
    return adminError(500, "처리하지 못했어요. 서버 기록을 확인해 주세요.");
  }
}

export async function readBody<T>(request: Request, schema: ZodType<T>): Promise<T | Response> {
  const raw = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return adminError(400, `요청 내용이 올바르지 않아요: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(", ")}`);
}

export const ok = (data: unknown = { ok: true }) => NextResponse.json(data, { headers: { "cache-control": "no-store" } });
