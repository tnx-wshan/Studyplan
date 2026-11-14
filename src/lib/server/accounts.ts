import "server-only";
import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { isValidEmail, normalizeEmail, passwordProblem } from "@/lib/account";
import { serverDb, transaction } from "./db";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** 학생 계정. 비밀번호는 salt를 섞은 scrypt 해시로만 저장한다. */

export interface Account {
  id: string;
  email: string;
  sessionVersion: number;
  createdAt: number;
  lastLoginAt: number | null;
}

interface AccountRow {
  id: string;
  email: string;
  password_hash: string;
  session_version: number;
  created_at: number;
  last_login_at: number | null;
}

const toAccount = (r: AccountRow): Account => ({
  id: r.id,
  email: r.email,
  sessionVersion: Number(r.session_version),
  createdAt: r.created_at,
  lastLoginAt: r.last_login_at,
});

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(password, Buffer.from(salt, "base64"), expected.length);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

let dummyHash: Promise<string> | null = null;

function rowByEmail(email: string): AccountRow | undefined {
  return serverDb().prepare("SELECT * FROM accounts WHERE email = ?").get(email) as AccountRow | undefined;
}

export function getAccount(id: string): Account | null {
  const r = serverDb().prepare("SELECT * FROM accounts WHERE id = ?").get(id) as AccountRow | undefined;
  return r ? toAccount(r) : null;
}

export type AccountResult = { ok: true; account: Account } | { ok: false; error: string; status: number };

const DUPLICATE: AccountResult = { ok: false, error: "이미 가입된 메일주소예요. 로그인해 주세요.", status: 409 };

export async function createAccount(emailInput: string, password: string, now = Date.now()): Promise<AccountResult> {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) return { ok: false, error: "메일주소 형식이 올바르지 않아요.", status: 400 };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem, status: 400 };
  if (rowByEmail(email)) return DUPLICATE;
  const hash = await hashPassword(password);
  const id = randomUUID();
  try {
    transaction(() => {
      serverDb()
        .prepare("INSERT INTO accounts (id, email, password_hash, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, email, hash, now, now, now);
    });
  } catch {
    // 거의 동시에 같은 메일로 가입한 경우 (unique 제약)
    return DUPLICATE;
  }
  return { ok: true, account: getAccount(id)! };
}

/** 메일이 없거나 비밀번호가 틀리면 같은 문구로 알려 준다 (가입 여부를 알아내지 못하게) */
export async function authenticate(emailInput: string, password: string, now = Date.now()): Promise<AccountResult> {
  const row = rowByEmail(normalizeEmail(emailInput));
  // 메일이 없어도 해시 계산을 한 번 해서, 걸리는 시간으로 가입 여부를 알아내지 못하게 한다
  dummyHash ??= hashPassword("no-such-account");
  const ok = await verifyPassword(password, row?.password_hash ?? (await dummyHash));
  if (!row || !ok) return { ok: false, error: "메일주소나 비밀번호가 맞지 않아요.", status: 401 };
  serverDb().prepare("UPDATE accounts SET last_login_at = ? WHERE id = ?").run(now, row.id);
  return { ok: true, account: toAccount({ ...row, last_login_at: now }) };
}

/** 비밀번호를 바꾸면 세션 버전이 올라가 다른 기기는 다시 로그인해야 한다. 새 버전이 든 계정을 돌려준다 */
async function setPassword(id: string, password: string, now: number): Promise<Account | null> {
  const hash = await hashPassword(password);
  serverDb().prepare("UPDATE accounts SET password_hash = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?").run(hash, now, id);
  return getAccount(id);
}

export async function changePassword(id: string, current: string, next: string, now = Date.now()): Promise<AccountResult> {
  const row = serverDb().prepare("SELECT * FROM accounts WHERE id = ?").get(id) as AccountRow | undefined;
  if (!row) return { ok: false, error: "계정을 찾을 수 없어요.", status: 404 };
  if (!(await verifyPassword(current, row.password_hash))) return { ok: false, error: "현재 비밀번호가 맞지 않아요.", status: 401 };
  const problem = passwordProblem(next);
  if (problem) return { ok: false, error: problem, status: 400 };
  if (next === current) return { ok: false, error: "새 비밀번호가 현재 비밀번호와 같아요.", status: 400 };
  const account = await setPassword(id, next, now);
  return account ? { ok: true, account } : { ok: false, error: "계정을 찾을 수 없어요.", status: 404 };
}

const TEMP_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

/** 관리자가 비밀번호를 잊은 학생에게 임시 비밀번호를 준다 (메일을 보내지 않으므로 직접 전달) */
export async function adminResetPassword(id: string, now = Date.now()): Promise<string | null> {
  if (!getAccount(id)) return null;
  const temp = Array.from(randomBytes(10), (b) => TEMP_CHARS[b % TEMP_CHARS.length]).join("") + "7a";
  await setPassword(id, temp, now);
  return temp;
}

/**
 * 계정 도입 전에 기기가 만든 사용자 id의 요약·명령을 계정 id로 옮긴다 (처음 로그인한 기기의 기록 유지).
 * 이미 이 계정의 요약이 있거나 다른 계정의 id면 건드리지 않는다.
 */
export function adoptDeviceUser(accountId: string, deviceId: string) {
  if (deviceId === accountId) return;
  transaction(() => {
    const db = serverDb();
    if (db.prepare("SELECT 1 FROM accounts WHERE id = ?").get(deviceId)) return;
    if (db.prepare("SELECT 1 FROM users WHERE id = ?").get(accountId)) return;
    const old = db.prepare("SELECT * FROM users WHERE id = ?").get(deviceId) as
      | { nickname: string; grade: string; status: string; memo: string; snapshot: string; created_at: number; last_seen_at: number }
      | undefined;
    if (!old) return;
    db.prepare("INSERT INTO users (id, nickname, grade, status, memo, snapshot, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      accountId, old.nickname, old.grade, old.status, old.memo, old.snapshot, old.created_at, old.last_seen_at,
    );
    db.prepare("UPDATE user_commands SET user_id = ? WHERE user_id = ?").run(accountId, deviceId);
    db.prepare("UPDATE bank_items SET created_by = ? WHERE created_by = ?").run(accountId, deviceId);
    db.prepare("DELETE FROM users WHERE id = ?").run(deviceId);
  });
}

/** 관리 도구용: 사용자 id → 메일주소 */
export function emailsById(): Map<string, string> {
  const rows = serverDb().prepare("SELECT id, email FROM accounts").all() as { id: string; email: string }[];
  return new Map(rows.map((r) => [r.id, r.email]));
}
