import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  checkPassword,
  createSessionToken,
  isAuthConfigured,
} from "@/lib/auth";

export async function POST(request: Request) {
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
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "비밀번호가 맞지 않아요." }, { status: 401 });
  }

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
