import "server-only";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth";
import type { Account } from "./accounts";

/** 로그인한 계정의 세션 쿠키를 응답에 붙인다 (1년, 이 기기에서 계속 로그인 상태) */
export function sessionResponse(account: Account, extra: Record<string, unknown> = {}): NextResponse {
  const response = NextResponse.json({ ok: true, accountId: account.id, email: account.email, ...extra }, { headers: { "cache-control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, createSessionToken(account.id, account.sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

/** 같은 주소에서 실패·시도가 몰리면 잠시 막는다. 서버 메모리에만 기록한다. */
export function createLimiter(windowMs: number, max: number) {
  const hits = new Map<string, number[]>();
  const recent = (key: string, now: number) => {
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    hits.set(key, list);
    return list;
  };
  return {
    blocked: (key: string, now = Date.now()) => recent(key, now).length >= max,
    add: (key: string, now = Date.now()) => hits.set(key, [...recent(key, now), now]),
    clear: (key: string) => hits.delete(key),
  };
}

export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const str = (v: unknown) => (typeof v === "string" ? v : "");
