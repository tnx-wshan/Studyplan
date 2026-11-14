import { NextResponse } from "next/server";
import { changePassword } from "@/lib/server/accounts";
import { currentAccount } from "@/lib/server/identity";
import { createLimiter, readJson, sessionResponse, str } from "@/lib/server/session";

/** 현재 비밀번호를 틀리는 시도는 계정마다 10분에 8번까지 */
const fails = createLimiter(10 * 60_000, 8);

/** 비밀번호 변경. 바꾸면 다른 기기의 로그인은 풀리고, 이 기기는 새 세션으로 계속 쓴다. */
export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  if (fails.blocked(account.id)) return NextResponse.json({ error: "현재 비밀번호를 여러 번 틀렸어요. 10분 뒤에 다시 시도해 주세요." }, { status: 429 });

  const result = await changePassword(account.id, str(body.current), str(body.next));
  if (!result.ok) {
    if (result.status === 401) {
      fails.add(account.id);
      await new Promise((r) => setTimeout(r, 800));
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  fails.clear(account.id);
  return sessionResponse(result.account);
}
