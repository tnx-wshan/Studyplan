import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, isAuthConfigured, parseSessionToken, verifySessionToken } from "./auth";

const ID = "11111111-1111-4111-8111-111111111111";

describe("auth session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
  });

  it("fails closed when not configured", () => {
    delete process.env.SESSION_SECRET;
    expect(isAuthConfigured()).toBe(false);
    expect(verifySessionToken(`${ID}.0.1.abc`)).toBe(false);
  });

  it("round-trips the account id and version", () => {
    const now = Date.now();
    expect(parseSessionToken(createSessionToken(ID, 3, now), now)).toEqual({ accountId: ID, version: 3 });
  });

  it("rejects tampered, other-account, expired, or other-secret tokens", () => {
    const now = Date.now();
    const token = createSessionToken(ID, 0, now);
    expect(verifySessionToken(token + "x", now)).toBe(false);
    expect(verifySessionToken(token.replace(ID, "22222222-2222-4222-8222-222222222222"), now)).toBe(false);
    expect(verifySessionToken(token.replace(`${ID}.0`, `${ID}.1`), now)).toBe(false);
    expect(verifySessionToken(token, now + 366 * 86_400_000)).toBe(false);
    process.env.SESSION_SECRET = "changed";
    expect(verifySessionToken(token, now)).toBe(false);
  });

  it("stays valid for a year so a device keeps its login", () => {
    const now = Date.now();
    expect(verifySessionToken(createSessionToken(ID, 0, now), now + 300 * 86_400_000)).toBe(true);
  });
});
