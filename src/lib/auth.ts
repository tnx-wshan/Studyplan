import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "hs_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일

function secret(): string | null {
  return process.env.SESSION_SECRET || null;
}

function sign(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** 서버 설정이 빠져 있으면 잠금을 풀지 않는다(fail closed). */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD && secret());
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected || !secret()) return false;
  return safeEqual(input, expected);
}

/** 세션 토큰: 발급 시각 + 서명. 비밀번호나 SESSION_SECRET을 바꾸면 기존 세션은 무효가 된다. */
export function createSessionToken(now = Date.now()): string {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is not set");
  const issued = String(now);
  return `${issued}.${sign(`${issued}:${process.env.APP_PASSWORD}`, key)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  const key = secret();
  if (!token || !key || !process.env.APP_PASSWORD) return false;
  const [issued, signature] = token.split(".");
  if (!issued || !signature) return false;
  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt)) return false;
  if (now - issuedAt > SESSION_MAX_AGE * 1000 || issuedAt > now + 60_000) return false;
  return safeEqual(signature, sign(`${issued}:${process.env.APP_PASSWORD}`, key));
}
