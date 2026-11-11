import "server-only";
import { GRADES, SUBJECT_GROUPS, type GradeId, type SubjectGroup } from "@/data/curriculum";
import { estimateMinutes, questionCount, sanitizeSteps } from "@/lib/learn/check";
import type { CourseInfo, CourseOutline, LearnSection, LearnUnit, Step, UnitStatus } from "@/lib/learn/types";
import { newServerId, parseJson, serverDb, transaction } from "./db";

/** 학습 탭 코스 내용 (섹션·유닛) 읽고 쓰기 */

export const isGrade = (g: unknown): g is GradeId => GRADES.some((x) => x.id === g);
export const isSubject = (s: unknown): s is SubjectGroup => SUBJECT_GROUPS.some((x) => x.id === s);

interface SectionRow {
  id: string;
  grade: string;
  subject: string;
  ord: number;
  title: string;
  description: string;
}

interface UnitRow {
  id: string;
  section_id: string;
  ord: number;
  title: string;
  minutes: number;
  status: string;
  steps: string;
  source_ids: string;
  updated_at: number;
}

const toSection = (r: SectionRow): LearnSection => ({
  id: r.id,
  grade: r.grade as GradeId,
  subject: r.subject as SubjectGroup,
  order: r.ord,
  title: r.title,
  description: r.description,
});

const toUnit = (r: UnitRow): LearnUnit => ({
  id: r.id,
  sectionId: r.section_id,
  order: r.ord,
  title: r.title,
  minutes: r.minutes,
  status: r.status as UnitStatus,
  steps: parseJson<Step[]>(r.steps, []),
  sourceIds: parseJson<string[]>(r.source_ids, []),
  updatedAt: r.updated_at,
});

/** 공개된 유닛이 있는 코스 목록 (관리자는 초안도 센다) */
export function listCourses(includeDrafts = false): CourseInfo[] {
  const rows = serverDb()
    .prepare(
      `SELECT s.grade AS grade, s.subject AS subject, COUNT(u.id) AS units
       FROM learn_sections s LEFT JOIN learn_units u ON u.section_id = s.id ${includeDrafts ? "" : "AND u.status = 'published'"}
       GROUP BY s.grade, s.subject`,
    )
    .all() as { grade: string; subject: string; units: number }[];
  return rows.map((r) => ({ grade: r.grade as GradeId, subject: r.subject as SubjectGroup, units: Number(r.units) }));
}

export function courseOutline(grade: GradeId, subject: SubjectGroup, includeDrafts = false): CourseOutline {
  const db = serverDb();
  const sections = (db.prepare("SELECT * FROM learn_sections WHERE grade = ? AND subject = ? ORDER BY ord, title").all(grade, subject) as unknown as SectionRow[]).map(toSection);
  const units = db
    .prepare(
      `SELECT u.* FROM learn_units u JOIN learn_sections s ON s.id = u.section_id
       WHERE s.grade = ? AND s.subject = ? ${includeDrafts ? "" : "AND u.status = 'published'"} ORDER BY u.ord, u.created_at`,
    )
    .all(grade, subject) as unknown as UnitRow[];
  return {
    grade,
    subject,
    sections: sections.map((s) => ({
      ...s,
      units: units
        .filter((u) => u.section_id === s.id)
        .map(toUnit)
        .map((u) => ({ id: u.id, title: u.title, minutes: u.minutes, questionCount: questionCount(u.steps), status: u.status })),
    })),
  };
}

export function getUnit(id: string, includeDrafts = false): (LearnUnit & { section: LearnSection }) | null {
  const db = serverDb();
  const row = db.prepare("SELECT * FROM learn_units WHERE id = ?").get(id) as UnitRow | undefined;
  if (!row || (!includeDrafts && row.status !== "published")) return null;
  const section = db.prepare("SELECT * FROM learn_sections WHERE id = ?").get(row.section_id) as SectionRow | undefined;
  if (!section) return null;
  return { ...toUnit(row), section: toSection(section) };
}

export function getSection(id: string): LearnSection | null {
  const row = serverDb().prepare("SELECT * FROM learn_sections WHERE id = ?").get(id) as SectionRow | undefined;
  return row ? toSection(row) : null;
}

/** 유닛 id → 코스(학년:과목). 관리 도구에서 사용자의 코스별 진도를 셀 때 쓴다 */
export function unitCourseMap(): Map<string, { grade: string; subject: string; title: string; section: string }> {
  const rows = serverDb()
    .prepare("SELECT u.id AS id, u.title AS title, s.title AS section, s.grade AS grade, s.subject AS subject FROM learn_units u JOIN learn_sections s ON s.id = u.section_id")
    .all() as { id: string; title: string; section: string; grade: string; subject: string }[];
  return new Map(rows.map((r) => [r.id, r]));
}

// ───────── 관리 도구: 섹션 ─────────

export function createSection(grade: GradeId, subject: SubjectGroup, title: string, description = ""): LearnSection {
  const db = serverDb();
  const max = db.prepare("SELECT COALESCE(MAX(ord), -1) AS m FROM learn_sections WHERE grade = ? AND subject = ?").get(grade, subject) as { m: number };
  const id = newServerId();
  db.prepare("INSERT INTO learn_sections (id, grade, subject, ord, title, description) VALUES (?, ?, ?, ?, ?, ?)").run(id, grade, subject, Number(max.m) + 1, title.trim(), description.trim());
  return getSection(id)!;
}

export function updateSection(id: string, patch: { title?: string; description?: string }) {
  const s = getSection(id);
  if (!s) return null;
  serverDb()
    .prepare("UPDATE learn_sections SET title = ?, description = ? WHERE id = ?")
    .run((patch.title ?? s.title).trim() || s.title, (patch.description ?? s.description).trim(), id);
  return getSection(id);
}

export function deleteSection(id: string) {
  serverDb().prepare("DELETE FROM learn_sections WHERE id = ?").run(id);
}

/** 순서 바꾸기: 위(-1)·아래(+1) 이웃과 자리를 바꾼다 */
export function moveSection(id: string, dir: -1 | 1) {
  const s = getSection(id);
  if (!s) return;
  const list = courseOutline(s.grade, s.subject, true).sections.map((x) => x.id);
  reorder("learn_sections", list, id, dir);
}

function reorder(table: "learn_sections" | "learn_units", ids: string[], id: string, dir: -1 | 1) {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  transaction(() => {
    const stmt = serverDb().prepare(`UPDATE ${table} SET ord = ? WHERE id = ?`);
    ids.forEach((x, k) => stmt.run(k, x));
  });
}

// ───────── 관리 도구: 유닛 ─────────

export interface UnitInput {
  title: string;
  steps: unknown;
  status?: UnitStatus;
  sourceIds?: string[];
}

/** 저장 전에 단계를 검사한다. 잘못된 단계가 있으면 저장하지 않고 이유를 돌려준다 */
export function validateUnit(input: UnitInput): { steps: Step[]; problems: string[] } {
  const { steps, problems } = sanitizeSteps(input.steps);
  if (!input.title.trim()) problems.unshift("유닛 이름이 비어 있어요.");
  if (steps.length === 0) problems.push("단계가 하나 이상 있어야 해요.");
  return { steps, problems };
}

export function createUnit(sectionId: string, input: UnitInput, now = Date.now()) {
  const { steps, problems } = validateUnit(input);
  if (problems.length) return { problems };
  const db = serverDb();
  if (!getSection(sectionId)) return { problems: ["섹션을 찾을 수 없어요."] };
  const max = db.prepare("SELECT COALESCE(MAX(ord), -1) AS m FROM learn_units WHERE section_id = ?").get(sectionId) as { m: number };
  const id = newServerId();
  db.prepare("INSERT INTO learn_units (id, section_id, ord, title, minutes, status, steps, source_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    id,
    sectionId,
    Number(max.m) + 1,
    input.title.trim(),
    estimateMinutes(steps),
    input.status ?? "draft",
    JSON.stringify(steps),
    JSON.stringify(input.sourceIds ?? []),
    now,
    now,
  );
  return { unit: getUnit(id, true)! };
}

export function updateUnit(id: string, input: Partial<UnitInput> & { sectionId?: string }, now = Date.now()) {
  const current = getUnit(id, true);
  if (!current) return { problems: ["유닛을 찾을 수 없어요."] };
  const merged: UnitInput = { title: input.title ?? current.title, steps: input.steps ?? current.steps, status: input.status ?? current.status, sourceIds: input.sourceIds ?? current.sourceIds };
  const { steps, problems } = validateUnit(merged);
  if (problems.length) return { problems };
  const sectionId = input.sectionId && getSection(input.sectionId) ? input.sectionId : current.sectionId;
  serverDb()
    .prepare("UPDATE learn_units SET section_id = ?, title = ?, minutes = ?, status = ?, steps = ?, source_ids = ?, updated_at = ? WHERE id = ?")
    .run(sectionId, merged.title.trim(), estimateMinutes(steps), merged.status ?? "draft", JSON.stringify(steps), JSON.stringify(merged.sourceIds ?? []), now, id);
  return { unit: getUnit(id, true)! };
}

export function deleteUnit(id: string) {
  serverDb().prepare("DELETE FROM learn_units WHERE id = ?").run(id);
}

export function moveUnit(id: string, dir: -1 | 1) {
  const u = getUnit(id, true);
  if (!u) return;
  const ids = (serverDb().prepare("SELECT id FROM learn_units WHERE section_id = ? ORDER BY ord, created_at").all(u.sectionId) as { id: string }[]).map((r) => r.id);
  reorder("learn_units", ids, id, dir);
}

export function learnCounts() {
  const r = serverDb().prepare("SELECT COUNT(*) AS total, SUM(status = 'published') AS published FROM learn_units").get() as { total: number; published: number | null };
  return { units: Number(r.total), published: Number(r.published ?? 0) };
}
