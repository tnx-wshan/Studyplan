import { NextResponse } from "next/server";
import { aiSetup, PROVIDER_LABELS } from "@/lib/ai/provider";
import { getUsage } from "@/lib/ai/usage";

/** 학생 화면용 AI 상태. 관리 도구 전용 사용량(유닛 만들기)은 빼고 보낸다 */
export async function GET() {
  const setup = aiSetup();
  return NextResponse.json(
    { ...setup, providerLabel: PROVIDER_LABELS[setup.provider], usage: (await getUsage()).filter((u) => u.feature !== "unit") },
    { headers: { "cache-control": "no-store" } },
  );
}
