import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_MAX_AGE, checkAdminPassword, createAdminToken, isAdminConfigured, isAdminServer } from "@/lib/auth";

/** 관리자 비밀번호를 계속 틀리면 잠시 막는다 (10분 동안 5번까지) */
const WINDOW_MS = 10 * 60_000;
const MAX_FAILS = 5;
const fails = new Map<string, number[]>();

export async function POST(request: Request) {
  if (!isAdminServer()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const key = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const recent = (fails.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_FAILS) return NextResponse.json({ error: "비밀번호를 여러 번 틀렸어요. 10분 뒤에 다시 시도해 주세요." }, { status: 429 });
  if (!isAdminConfigured()) return NextResponse.json({ error: "서버에 ADMIN_PASSWORD와 SESSION_SECRET이 설정되지 않았어요." }, { status: 500 });

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!checkAdminPassword(password)) {
    fails.set(key, [...recent, now]);
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "관리자 비밀번호가 맞지 않아요." }, { status: 401 });
  }
  fails.delete(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
  return response;
}
