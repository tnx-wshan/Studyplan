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

// ───────── 서명한 값 (사용자 id 쿠키) ─────────

/** 값에 서명을 붙인다. purpose가 다르면 서로의 서명으로 쓸 수 없다 */
export function signValue(value: string, purpose: string): string {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is not set");
  return `${value}.${sign(`${purpose}:${value}`, key)}`;
}

export function verifySignedValue(token: string | undefined, purpose: string): string | null {
  const key = secret();
  if (!token || !key) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const value = token.slice(0, i);
  return safeEqual(token.slice(i + 1), sign(`${purpose}:${value}`, key)) ? value : null;
}

/** 이 기기의 사용자 id (동기화할 때 서버가 발급) */
export const USER_COOKIE = "hs_uid";

// ───────── 관리 도구 ─────────

/**
 * 관리 도구는 같은 빌드를 ADMIN_SERVER=1로 다른 포트에 띄운 서버에서만 열린다 (npm run admin).
 * 학생이 쓰는 서버에서는 /admin 주소가 없는 것처럼 보인다.
 */
export function isAdminServer(): boolean {
  return process.env.ADMIN_SERVER === "1";
}

export const ADMIN_COOKIE = "hs_admin";
export const ADMIN_MAX_AGE = 60 * 60 * 12; // 12시간

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && secret());
}

export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !secret()) return false;
  return safeEqual(input, expected);
}

export function createAdminToken(now = Date.now()): string {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is not set");
  const issued = String(now);
  return `${issued}.${sign(`admin:${issued}:${process.env.ADMIN_PASSWORD}`, key)}`;
}

export function verifyAdminToken(token: string | undefined, now = Date.now()): boolean {
  const key = secret();
  if (!token || !key || !process.env.ADMIN_PASSWORD) return false;
  const [issued, signature] = token.split(".");
  if (!issued || !signature) return false;
  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt)) return false;
  if (now - issuedAt > ADMIN_MAX_AGE * 1000 || issuedAt > now + 60_000) return false;
  return safeEqual(signature, sign(`admin:${issued}:${process.env.ADMIN_PASSWORD}`, key));
}
