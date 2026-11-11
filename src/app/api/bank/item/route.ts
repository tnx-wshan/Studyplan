import { NextResponse } from "next/server";
import { jsonError } from "@/lib/ai/route-helpers";
import { childrenOf, getItem, markUsed } from "@/lib/server/bank";
import { rejectIfSuspended } from "@/lib/server/guard";

/** 자료 하나와 그 자료로 만든 문제들 */
export async function GET(request: Request) {
  const blocked = await rejectIfSuspended();
  if (blocked) return blocked;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const item = getItem(id);
  if (!item || item.kind !== "material" || item.status !== "active") return jsonError(404, "자료를 찾을 수 없어요.");
  return NextResponse.json({ material: item, quizzes: childrenOf(id) });
}

/** 학생이 자료를 내 기기로 가져갔다 (얼마나 쓰였는지 센다) */
export async function POST(request: Request) {
  const blocked = await rejectIfSuspended();
  if (blocked) return blocked;
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id || !getItem(body.id)) return jsonError(404, "자료를 찾을 수 없어요.");
  markUsed(body.id);
  return NextResponse.json({ ok: true });
}
