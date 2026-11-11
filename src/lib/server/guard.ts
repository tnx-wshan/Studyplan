import "server-only";
import { NextResponse } from "next/server";
import { currentUserId } from "./identity";
import { isSuspended } from "./users";

export const SUSPENDED_MESSAGE = "이용이 정지된 계정이에요. 관리자에게 문의해 주세요.";

/** 관리자가 이용을 정지한 사용자의 요청은 막는다 */
export async function rejectIfSuspended(): Promise<Response | null> {
  const uid = await currentUserId();
  return isSuspended(uid) ? NextResponse.json({ error: SUSPENDED_MESSAGE, suspended: true }, { status: 403 }) : null;
}

export function noStore(): HeadersInit {
  return { "cache-control": "no-store" };
}
