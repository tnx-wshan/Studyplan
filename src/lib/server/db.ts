import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedLearn } from "./seed";

/**
 * 서버 DB (Node 내장 SQLite). 학생 개인 데이터는 여전히 기기(IndexedDB)에 있고,
 * 여기에는 여러 사용자가 함께 쓰는 것만 둔다:
 *   - users / user_commands: 관리 도구가 보는 사용자 요약과, 관리자가 고친 값(기기가 다음 접속 때 적용)
 *   - bank_items: AI 학습실에서 만든 정리·문제 모음 (중복 생성 방지, AI 없이도 쓰기)
 *   - learn_sections / learn_units: 학습 탭의 코스 내용
 *
 * 앱 서버와 관리 서버(다른 포트)가 같은 파일을 쓴다. WAL 모드라 두 프로세스가 함께 읽고 쓸 수 있다.
 * 파일 이름은 HOMESTUDY_DB_NAME으로 바꿀 수 있다 (브라우저 테스트는 따로 쓴다).
 */

type Migration = (db: DatabaseSync) => void;

const MIGRATIONS: Migration[] = [
  // 1: 첫 구조
  (db) => {
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL DEFAULT '',
        grade TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        memo TEXT NOT NULL DEFAULT '',
        snapshot TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      );
      CREATE TABLE user_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        applied_at INTEGER
      );
      CREATE INDEX user_commands_user ON user_commands(user_id, id);
      CREATE TABLE bank_items (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        lookup_key TEXT NOT NULL,
        source_kind TEXT NOT NULL DEFAULT '',
        grade TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL DEFAULT '',
        subject_name TEXT NOT NULL DEFAULT '',
        topic TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        data TEXT NOT NULL,
        parent_id TEXT,
        created_by TEXT,
        made_by TEXT NOT NULL DEFAULT '',
        uses INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        edited INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX bank_lookup ON bank_items(lookup_key, status);
      CREATE INDEX bank_parent ON bank_items(parent_id);
      CREATE INDEX bank_course ON bank_items(kind, grade, subject);
      CREATE TABLE learn_sections (
        id TEXT PRIMARY KEY,
        grade TEXT NOT NULL,
        subject TEXT NOT NULL,
        ord INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX learn_sections_course ON learn_sections(grade, subject, ord);
      CREATE TABLE learn_units (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL REFERENCES learn_sections(id) ON DELETE CASCADE,
        ord INTEGER NOT NULL,
        title TEXT NOT NULL,
        minutes INTEGER NOT NULL DEFAULT 3,
        status TEXT NOT NULL DEFAULT 'draft',
        steps TEXT NOT NULL DEFAULT '[]',
        source_ids TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX learn_units_section ON learn_units(section_id, ord);
    `);
  },
];

function migrate(db: DatabaseSync) {
  const current = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
  if (current >= MIGRATIONS.length) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    // 다른 프로세스가 먼저 올렸을 수 있으므로 잠근 뒤 다시 확인한다
    const again = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    for (let v = again; v < MIGRATIONS.length; v++) MIGRATIONS[v](db);
    // 새 DB면 예제 학습 데이터를 넣는다
    if (again === 0) seedLearn(db);
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

let instance: DatabaseSync | null = null;

function dbFile(): string {
  const name = (process.env.HOMESTUDY_DB_NAME || "homestudy.db").replace(/[^a-zA-Z0-9._-]/g, "");
  return path.join(process.cwd(), ".data", name || "homestudy.db");
}

export function serverDb(): DatabaseSync {
  if (instance) return instance;
  const file = dbFile();
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  migrate(db);
  instance = db;
  return db;
}

/** 테스트용: 메모리 DB로 바꾼다 */
export function openMemoryDb(): DatabaseSync {
  instance?.close();
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  instance = db;
  return db;
}

/** 여러 문장을 한 번에 (실패하면 모두 되돌린다) */
export function transaction<T>(fn: () => T): T {
  const db = serverDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function parseJson<T>(text: unknown, fallback: T): T {
  if (typeof text !== "string") return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export const newServerId = () => crypto.randomUUID();
