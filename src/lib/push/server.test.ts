import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const sent: { endpoint: string; payload: { title: string; url: string } }[] = [];
let failWith: number | null = null;
vi.mock("web-push", () => ({
  generateVAPIDKeys: () => ({ publicKey: "PUB", privateKey: "PRIV" }),
  sendNotification: async (sub: { endpoint: string }, payload: string) => {
    if (failWith) throw Object.assign(new Error("fail"), { statusCode: failWith });
    sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
  },
}));

const cwd = process.cwd();
beforeAll(() => process.chdir(mkdtempSync(path.join(tmpdir(), "hs-push-"))));
afterAll(() => process.chdir(cwd));

describe("push server", () => {
  it("stores subscriptions, sends due reminders once, and drops gone endpoints", async () => {
    const s = await import("./server");
    expect(await s.getPublicKey()).toBe("PUB");
    const settings = { review: "19:00", plan: null, streak: "21:00", style: "cute" as const };
    await s.upsertSubscription({ endpoint: "https://push.example/a", keys: { p256dh: "k", auth: "a" } }, settings);

    // 서울 19:05 = UTC 10:05
    expect(await s.runReminders(new Date("2026-11-11T10:05:00Z"))).toBe(1);
    expect(sent.at(-1)?.payload.url).toBe("/review");
    expect(await s.runReminders(new Date("2026-11-11T10:06:00Z"))).toBe(0);

    // 오늘 공부했으면 연속 알림 안 보냄
    await s.markStudied("2026-11-11");
    expect(await s.runReminders(new Date("2026-11-11T12:01:00Z"))).toBe(0);

    expect(await s.sendTest("https://push.example/a")).toBe("ok");
    expect(await s.sendTest("https://push.example/none")).toBe("missing");

    // 다음 날, 구독이 만료(410)되면 지운다
    failWith = 410;
    await s.runReminders(new Date("2026-11-12T10:00:00Z"));
    failWith = null;
    expect(await s.sendTest("https://push.example/a")).toBe("missing");
  });
});
