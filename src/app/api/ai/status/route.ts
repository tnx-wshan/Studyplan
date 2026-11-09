import { NextResponse } from "next/server";
import { aiSetup, PROVIDER_LABELS } from "@/lib/ai/provider";
import { getUsage } from "@/lib/ai/usage";

export async function GET() {
  const setup = aiSetup();
  return NextResponse.json(
    { ...setup, providerLabel: PROVIDER_LABELS[setup.provider], usage: await getUsage() },
    { headers: { "cache-control": "no-store" } },
  );
}
