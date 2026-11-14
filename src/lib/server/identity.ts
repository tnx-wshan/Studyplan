import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, SESSION_COOKIE, isAdminServer, parseSessionToken, verifyAdminToken } from "@/lib/auth";
import { getAccount, type Account } from "./accounts";

/**
 * 요청을 보낸 학생 계정. 세션 서명이 맞고 계정이 있으며 세션 버전이 같을 때만 돌려준다
 * (비밀번호를 바꾸면 버전이 올라가 다른 기기의 세션은 여기서 끊긴다).
 */
export async function currentAccount(): Promise<Account | null> {
  const session = parseSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const account = getAccount(session.accountId);
  return account && account.sessionVersion === session.version ? account : null;
}

/** 요청을 보낸 학생의 사용자 id (= 계정 id) */
export async function currentUserId(): Promise<string | null> {
  return (await currentAccount())?.id ?? null;
}

/** 관리 API는 관리 서버에서, 관리자 로그인이 된 요청만 받는다 (프록시가 먼저 막지만 한 번 더 확인) */
export async function isAdminRequest(): Promise<boolean> {
  return isAdminServer() && verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}
