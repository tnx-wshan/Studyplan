import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  checkPassword,
  createSessionToken,
  isAuthConfigured,
} from "@/lib/auth";

/** 비밀번호를 계속 틀리면 잠시 막는다 (10분 동안 8번까지). 서버 메모리에만 기록한다. */
const WINDOW_MS = 10 * 60_000;
const MAX_FAILS = 8;
const fails = new Map<string, number[]>();

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

function recentFails(key: string, now: number): number[] {
  const list = (fails.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  fails.set(key, list);
  return list;
}

export async function POST(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  if (recentFails(key, now).length >= MAX_FAILS) {
    return NextResponse.json({ error: "비밀번호를 여러 번 틀렸어요. 10분 뒤에 다시 시도해 주세요." }, { status: 429 });
  }
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "서버에 APP_PASSWORD와 SESSION_SECRET이 설정되지 않았어요. .env.local을 확인해 주세요." },
      { status: 500 },
    );
  }

  let password = "";
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (!checkPassword(password)) {
    // 무차별 대입을 늦추기 위한 지연
    fails.set(key, [...recentFails(key, now), now]);
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "비밀번호가 맞지 않아요." }, { status: 401 });
  }

  fails.delete(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
