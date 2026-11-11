import { NextResponse } from "next/server";
import { jsonError } from "@/lib/ai/route-helpers";
import { rejectIfSuspended } from "@/lib/server/guard";
import { getUnit } from "@/lib/server/learn";

/** 유닛 하나 (핵심 정리와 문제) */
export async function GET(request: Request) {
  const blocked = await rejectIfSuspended();
  if (blocked) return blocked;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const unit = getUnit(id);
  if (!unit) return jsonError(404, "유닛을 찾을 수 없어요. 내용이 바뀌었을 수 있으니 학습 지도로 돌아가 주세요.");
  return NextResponse.json(unit);
}
