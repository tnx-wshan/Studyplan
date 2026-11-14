import { NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/auth";
import { authenticate } from "@/lib/server/accounts";
import { clientKey, createLimiter, readJson, sessionResponse, str } from "@/lib/server/session";
import { SUSPENDED_MESSAGE } from "@/lib/server/guard";
import { isSuspended } from "@/lib/server/users";
import { normalizeEmail } from "@/lib/account";

/** 틀리면 잠시 막는다 (같은 주소에서 10분에 8번, 같은 메일주소는 10분에 8번) */
const byIp = createLimiter(10 * 60_000, 8);
const byEmail = createLimiter(10 * 60_000, 8);

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "서버에 SESSION_SECRET이 설정되지 않았어요. .env.local을 확인해 주세요." }, { status: 500 });
  }
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  const email = normalizeEmail(str(body.email));
  const ip = clientKey(request);
  if (byIp.blocked(ip) || byEmail.blocked(email)) {
    return NextResponse.json({ error: "로그인을 여러 번 틀렸어요. 10분 뒤에 다시 시도해 주세요." }, { status: 429 });
  }

  const result = await authenticate(email, str(body.password));
  if (!result.ok) {
    byIp.add(ip);
    byEmail.add(email);
    // 무차별 대입을 늦추기 위한 지연
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (isSuspended(result.account.id)) return NextResponse.json({ error: SUSPENDED_MESSAGE }, { status: 403 });
  byIp.clear(ip);
  byEmail.clear(email);
  return sessionResponse(result.account);
}
