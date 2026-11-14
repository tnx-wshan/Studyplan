import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/server/identity";

/** 지금 로그인한 계정 (세션이 끊겼으면 401) */
export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  return NextResponse.json({ accountId: account.id, email: account.email }, { headers: { "cache-control": "no-store" } });
}
