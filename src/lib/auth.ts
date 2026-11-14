import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "hs_session";
/** 한 번 로그인하면 그 기기에서 계속 쓴다 (1년) */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

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

/** 서버 설정이 빠져 있으면 로그인을 열지 않는다(fail closed). */
export function isAuthConfigured(): boolean {
  return Boolean(secret());
}

// ───────── 학생 계정 세션 ─────────

export interface SessionInfo {
  accountId: string;
  /** 계정의 세션 버전. 비밀번호를 바꾸면 올라가서 다른 기기의 세션이 끊긴다 */
  version: number;
}

/** 세션 토큰: `계정id.버전.발급시각.서명`. 서명만 보면 되므로 프록시에서 DB 없이 확인한다. */
export function createSessionToken(accountId: string, version = 0, now = Date.now()): string {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is not set");
  const body = `${accountId}.${version}.${now}`;
  return `${body}.${sign(`session:${body}`, key)}`;
}

export function parseSessionToken(token: string | undefined, now = Date.now()): SessionInfo | null {
  const key = secret();
  if (!token || !key) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [accountId, ver, issued, signature] = parts;
  if (!accountId || !signature) return null;
  const issuedAt = Number(issued);
  const version = Number(ver);
  if (!Number.isFinite(issuedAt) || !Number.isInteger(version)) return null;
  if (now - issuedAt > SESSION_MAX_AGE * 1000 || issuedAt > now + 60_000) return null;
  if (!safeEqual(signature, sign(`session:${accountId}.${ver}.${issued}`, key))) return null;
  return { accountId, version };
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  return parseSessionToken(token, now) !== null;
}

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
