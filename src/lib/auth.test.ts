import { beforeEach, describe, expect, it } from "vitest";
import { checkPassword, createSessionToken, isAuthConfigured, verifySessionToken } from "./auth";

describe("auth", () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = "123456";
    process.env.SESSION_SECRET = "test-secret";
  });

  it("checks the password", () => {
    expect(checkPassword("123456")).toBe(true);
    expect(checkPassword("12345")).toBe(false);
    expect(checkPassword("")).toBe(false);
  });

  it("fails closed when not configured", () => {
    delete process.env.SESSION_SECRET;
    expect(isAuthConfigured()).toBe(false);
    expect(checkPassword("123456")).toBe(false);
    expect(verifySessionToken("1.abc")).toBe(false);
  });

  it("verifies its own tokens", () => {
    const now = Date.now();
    expect(verifySessionToken(createSessionToken(now), now)).toBe(true);
  });

  it("rejects tampered, expired, or stale-password tokens", () => {
    const now = Date.now();
    const token = createSessionToken(now);
    expect(verifySessionToken(token + "x", now)).toBe(false);
    expect(verifySessionToken(`${now + 1}.${token.split(".")[1]}`, now + 1)).toBe(false);
    expect(verifySessionToken(token, now + 31 * 86_400_000)).toBe(false);
    process.env.APP_PASSWORD = "changed";
    expect(verifySessionToken(token, now)).toBe(false);
  });
});
