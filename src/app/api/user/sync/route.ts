import { NextResponse } from "next/server";
import { USER_COOKIE, signValue } from "@/lib/auth";
import { parseBody } from "@/lib/ai/route-helpers";
import { syncUser } from "@/lib/server/users";
import { SyncRequestSchema, type SyncResponse } from "@/lib/sync/types";

/** 기기 요약을 받아 저장하고, 관리자가 내린 명령과 이용 상태를 돌려준다 */
export async function POST(request: Request) {
  const body = await parseBody(request, SyncRequestSchema);
  if (body instanceof Response) return body;
  const result: SyncResponse = syncUser(body);
  const response = NextResponse.json(result);
  // AI 학습실이 누가 만든 자료인지 기록하고, 이용 정지된 사용자를 막을 때 쓴다
  response.cookies.set(USER_COOKIE, signValue(body.userId, "uid"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
