import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applyBaseCurriculum } from "./base-curriculum";
import { seedLearn } from "./seed";
import { repairDeep } from "@/lib/ai/text";

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
  // 2: 백슬래시 하나로 와서 탭 같은 제어 문자가 된 수식 명령(\times → 탭+imes)을 저장된 자료에서 되돌린다
  (db) => {
    repairJsonColumn(db, "bank_items", "data");
    repairJsonColumn(db, "learn_units", "steps");
  },
  // 3: 문제·설명에 들어가는 그림 (같은 그림은 sha로 한 번만 저장)
  (db) => {
    db.exec(`
      CREATE TABLE media (
        id TEXT PRIMARY KEY,
        mime TEXT NOT NULL,
        data BLOB NOT NULL,
        size INTEGER NOT NULL,
        sha TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'admin',
        created_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX media_sha ON media(sha);
    `);
  },
  // 4: 자료 모음을 "학년 · 과목 · 출판사 · 연도 · 단원"으로 나눠 모은다
  (db) => {
    db.exec(`
      ALTER TABLE bank_items ADD COLUMN publisher TEXT NOT NULL DEFAULT '';
      ALTER TABLE bank_items ADD COLUMN year INTEGER;
      ALTER TABLE bank_items ADD COLUMN unit TEXT NOT NULL DEFAULT '';
      CREATE INDEX bank_class ON bank_items(kind, grade, subject, publisher);
    `);
  },
  // 5: 학습 코스에 과목 추가 (기본 5과목 외에 학년마다 수학2·역사·체육 등)
  (db) => {
    db.exec(`
      CREATE TABLE learn_subjects (
        key TEXT PRIMARY KEY,
        grade TEXT NOT NULL,
        name TEXT NOT NULL,
        short TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '',
        grp TEXT,
        ord INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX learn_subjects_name ON learn_subjects(grade, name);
    `);
  },
  // 6: 학년·과목·학기별 기본 단원(섹션 목차)을 넣는다. 고2·고3 선택과목은 과목도 만든다 (src/data/learn/baseCurriculum.ts)
  (db) => {
    applyBaseCurriculum(db);
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

/** JSON 칸 안의 모든 글자에 수식 명령 보정을 적용한다 (바뀐 줄만 다시 쓴다) */
export function repairJsonColumn(db: DatabaseSync, table: "bank_items" | "learn_units", column: "data" | "steps") {
  const rows = db.prepare(`SELECT id, ${column} AS value FROM ${table}`).all() as { id: string; value: string }[];
  const update = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`);
  for (const r of rows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(r.value);
    } catch {
      continue;
    }
    const fixed = JSON.stringify(repairDeep(parsed));
    if (fixed !== r.value) update.run(fixed, r.id);
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
