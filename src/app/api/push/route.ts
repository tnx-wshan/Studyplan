import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicKey, markStudied, removeSubscription, sendTest, upsertSubscription } from "@/lib/push/server";

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("subscribe"),
    subscription: z.object({ endpoint: z.string().url().max(2000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
    settings: z.object({ review: time, plan: time, streak: time, style: z.enum(["cute", "noir"]) }),
  }),
  z.object({ action: z.literal("unsubscribe"), endpoint: z.string().max(2000) }),
  z.object({ action: z.literal("test"), endpoint: z.string().max(2000) }),
  z.object({ action: z.literal("studied"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
]);

/** 공개 키 (구독할 때 필요) */
export async function GET() {
  return NextResponse.json({ publicKey: await getPublicKey() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "요청 내용이 올바르지 않아요." }, { status: 400 });
  const body = parsed.data;
  switch (body.action) {
    case "subscribe":
      await upsertSubscription(body.subscription, body.settings);
      return NextResponse.json({ ok: true });
    case "unsubscribe":
      await removeSubscription(body.endpoint);
      return NextResponse.json({ ok: true });
    case "test": {
      const r = await sendTest(body.endpoint);
      return r === "ok" ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r === "missing" ? "등록된 알림이 없어요. 다시 켜 주세요." : "알림을 보내지 못했어요." }, { status: 502 });
    }
    case "studied":
      await markStudied(body.date);
      return NextResponse.json({ ok: true });
  }
}
