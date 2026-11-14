import "server-only";
import type { StoredCommand, SyncRequest, UserCommand, UserSnapshot, UserStatus } from "@/lib/sync/types";
import { parseJson, serverDb, transaction } from "./db";

/** 관리 도구가 보는 사용자 목록과, 관리자가 내린 명령 */

export interface ServerUser {
  id: string;
  nickname: string;
  grade: string;
  status: UserStatus;
  memo: string;
  snapshot: Partial<UserSnapshot>;
  createdAt: number;
  lastSeenAt: number;
  pendingCommands: number;
}

interface UserRow {
  id: string;
  nickname: string;
  grade: string;
  status: string;
  memo: string;
  snapshot: string;
  created_at: number;
  last_seen_at: number;
  pending?: number;
}

const toUser = (r: UserRow): ServerUser => ({
  id: r.id,
  nickname: r.nickname,
  grade: r.grade,
  status: r.status === "suspended" ? "suspended" : "active",
  memo: r.memo,
  snapshot: parseJson<Partial<UserSnapshot>>(r.snapshot, {}),
  createdAt: r.created_at,
  lastSeenAt: r.last_seen_at,
  pendingCommands: Number(r.pending ?? 0),
});

interface CommandRow {
  id: number;
  type: string;
  payload: string;
  created_at: number;
  applied_at: number | null;
}

const toCommand = (r: CommandRow): StoredCommand => ({
  id: Number(r.id),
  type: r.type as StoredCommand["type"],
  payload: parseJson(r.payload, {}) as StoredCommand["payload"],
  createdAt: r.created_at,
  appliedAt: r.applied_at,
});

/**
 * 기기가 보낸 요약을 저장하고, 아직 적용하지 않은 명령을 돌려준다.
 * 기기가 lastCommandId까지 적용했다고 알려주면 그 명령들은 적용됨으로 표시한다.
 */
export function syncUser(req: SyncRequest, now = Date.now()) {
  return transaction(() => {
    const db = serverDb();
    db.prepare(
      `INSERT INTO users (id, nickname, grade, snapshot, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET nickname = excluded.nickname, grade = excluded.grade, snapshot = excluded.snapshot, last_seen_at = excluded.last_seen_at`,
    ).run(req.userId, req.nickname.trim(), req.grade, JSON.stringify(req.snapshot), now, now);
    db.prepare("UPDATE user_commands SET applied_at = ? WHERE user_id = ? AND id <= ? AND applied_at IS NULL").run(now, req.userId, req.lastCommandId);
    const status = (db.prepare("SELECT status FROM users WHERE id = ?").get(req.userId) as { status: string }).status;
    const commands = (db.prepare("SELECT * FROM user_commands WHERE user_id = ? AND id > ? AND applied_at IS NULL ORDER BY id").all(req.userId, req.lastCommandId) as unknown as CommandRow[]).map(toCommand);
    return { userId: req.userId, status: (status === "suspended" ? "suspended" : "active") as UserStatus, commands };
  });
}

export function userStatus(id: string): UserStatus | null {
  const r = serverDb().prepare("SELECT status FROM users WHERE id = ?").get(id) as { status: string } | undefined;
  if (!r) return null;
  return r.status === "suspended" ? "suspended" : "active";
}

export function isSuspended(id: string | null | undefined): boolean {
  return !!id && userStatus(id) === "suspended";
}

export function listUsers(): ServerUser[] {
  const rows = serverDb()
    .prepare(
      `SELECT u.*, (SELECT COUNT(*) FROM user_commands c WHERE c.user_id = u.id AND c.applied_at IS NULL) AS pending
       FROM users u ORDER BY u.last_seen_at DESC`,
    )
    .all() as unknown as UserRow[];
  return rows.map(toUser);
}

export function getUser(id: string): (ServerUser & { commands: StoredCommand[] }) | null {
  const db = serverDb();
  const row = db
    .prepare(`SELECT u.*, (SELECT COUNT(*) FROM user_commands c WHERE c.user_id = u.id AND c.applied_at IS NULL) AS pending FROM users u WHERE u.id = ?`)
    .get(id) as UserRow | undefined;
  if (!row) return null;
  const commands = (db.prepare("SELECT * FROM user_commands WHERE user_id = ? ORDER BY id DESC LIMIT 50").all(id) as unknown as CommandRow[]).map(toCommand);
  return { ...toUser(row), commands };
}

export function updateUser(id: string, patch: { status?: UserStatus; memo?: string }) {
  const u = getUser(id);
  if (!u) return null;
  serverDb()
    .prepare("UPDATE users SET status = ?, memo = ? WHERE id = ?")
    .run(patch.status ?? u.status, (patch.memo ?? u.memo).slice(0, 1000), id);
  return getUser(id);
}

export function addCommand(userId: string, command: UserCommand, now = Date.now()): StoredCommand | null {
  if (!getUser(userId)) return null;
  const db = serverDb();
  const r = db.prepare("INSERT INTO user_commands (user_id, type, payload, created_at) VALUES (?, ?, ?, ?)").run(userId, command.type, JSON.stringify(command.payload), now);
  return toCommand(db.prepare("SELECT * FROM user_commands WHERE id = ?").get(Number(r.lastInsertRowid)) as unknown as CommandRow);
}

/** 아직 적용되지 않은 명령은 취소할 수 있다 */
export function cancelCommand(userId: string, commandId: number): boolean {
  const r = serverDb().prepare("DELETE FROM user_commands WHERE id = ? AND user_id = ? AND applied_at IS NULL").run(commandId, userId);
  return Number(r.changes) > 0;
}

export function deleteUser(id: string) {
  serverDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function userCounts(now = Date.now()) {
  const db = serverDb();
  const total = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  const week = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE last_seen_at > ?").get(now - 7 * 86_400_000) as { n: number }).n;
  const suspended = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'suspended'").get() as { n: number }).n;
  return { total: Number(total), activeWeek: Number(week), suspended: Number(suspended) };
}
