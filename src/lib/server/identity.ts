import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, USER_COOKIE, isAdminServer, verifyAdminToken, verifySignedValue } from "@/lib/auth";

/** 요청을 보낸 기기의 사용자 id (동기화 전이면 null) */
export async function currentUserId(): Promise<string | null> {
  return verifySignedValue((await cookies()).get(USER_COOKIE)?.value, "uid");
}

/** 관리 API는 관리 서버에서, 관리자 로그인이 된 요청만 받는다 (프록시가 먼저 막지만 한 번 더 확인) */
export async function isAdminRequest(): Promise<boolean> {
  return isAdminServer() && verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}
