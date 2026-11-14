import { NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/auth";
import { createAccount } from "@/lib/server/accounts";
import { clientKey, createLimiter, readJson, sessionResponse, str } from "@/lib/server/session";

/** 같은 주소에서 가입은 1시간에 10번까지 */
const signups = createLimiter(60 * 60_000, 10);

/** 메일주소와 비밀번호로 가입한다 (메일 인증은 하지 않는다). 가입하면 바로 로그인된다. */
export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "서버에 SESSION_SECRET이 설정되지 않았어요. .env.local을 확인해 주세요." }, { status: 500 });
  }
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  const ip = clientKey(request);
  if (signups.blocked(ip)) return NextResponse.json({ error: "가입 시도가 너무 많아요. 잠시 뒤에 다시 시도해 주세요." }, { status: 429 });
  signups.add(ip);

  const result = await createAccount(str(body.email), str(body.password));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return sessionResponse(result.account);
}
