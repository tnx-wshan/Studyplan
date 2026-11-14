import { NextResponse } from "next/server";
import { parseBody } from "@/lib/ai/route-helpers";
import { adoptDeviceUser } from "@/lib/server/accounts";
import { currentAccount } from "@/lib/server/identity";
import { syncUser } from "@/lib/server/users";
import { SyncRequestSchema, type SyncResponse } from "@/lib/sync/types";

/**
 * 기기 요약을 받아 저장하고, 관리자가 내린 명령과 이용 상태를 돌려준다.
 * 사용자 id는 로그인한 계정의 id를 쓴다 (기기가 보낸 id는 계정 도입 전 기록을 이어 붙일 때만 본다).
 */
export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "unauthorized", loggedOut: true }, { status: 401 });
  const body = await parseBody(request, SyncRequestSchema);
  if (body instanceof Response) return body;
  adoptDeviceUser(account.id, body.userId);
  const result: SyncResponse = syncUser({ ...body, userId: account.id });
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
