import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { SUBJECT_GROUPS, type GradeId } from "@/data/curriculum";
import { BASE_COURSES, baseSectionDescription, isBuiltInBase, type BaseCourse } from "@/data/learn/baseCurriculum";

/**
 * 기본 단원(학년·과목·학기별 대단원, `src/data/learn/baseCurriculum.ts`)을 서버 DB의 섹션으로 넣는다.
 * 섹션만 만들고 유닛은 만들지 않는다(유닛은 일괄 넣기·AI로 채운다). 유닛이 없는 섹션은 학생에게 '준비 중'.
 */

interface Row {
  id: string;
  title: string;
  description: string;
  units: number;
}

/** 기본 단원의 과목 열쇠. 고2·고3 선택과목은 없으면 과목을 만든다(make가 false면 찾기만) */
function subjectKey(db: DatabaseSync, course: BaseCourse, make: boolean, now: number): string | null {
  if (isBuiltInBase(course)) return course.subject;
  const found = db.prepare("SELECT key FROM learn_subjects WHERE grade = ? AND name = ?").get(course.grade, course.subject) as { key: string } | undefined;
  if (found) return found.key;
  if (!make) return null;
  const count = Number((db.prepare("SELECT COUNT(*) AS n FROM learn_subjects WHERE grade = ?").get(course.grade) as { n: number }).n);
  const color = SUBJECT_GROUPS.find((g) => g.id === course.group)?.color ?? "#8d6e63";
  const key = `s-${crypto.randomUUID().slice(0, 8)}`;
  db.prepare("INSERT INTO learn_subjects (key, grade, name, short, color, grp, ord, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    key,
    course.grade,
    course.subject,
    (course.short ?? course.subject.slice(0, 2)).slice(0, 2),
    color,
    course.group ?? null,
    count,
    now,
  );
  return key;
}

function sectionsOf(db: DatabaseSync, grade: string, subject: string): Row[] {
  return db
    .prepare(
      `SELECT s.id AS id, s.title AS title, s.description AS description, COUNT(u.id) AS units
       FROM learn_sections s LEFT JOIN learn_units u ON u.section_id = s.id
       WHERE s.grade = ? AND s.subject = ? GROUP BY s.id ORDER BY s.ord, s.title`,
    )
    .all(grade, subject) as unknown as Row[];
}

/**
 * 처음 한 번(마이그레이션 6): 모든 학년·과목에 기본 단원을 넣는다.
 * - 아무 섹션도 없는 코스: 그대로 넣는다.
 * - 유닛이 든 섹션이 모두 기본 단원 이름과 같은 코스(예제 유닛만 있는 중1 수학 등): 기본 단원 순서로 맞추고 빠진 섹션을 넣는다.
 *   유닛이 없는 다른 이름의 섹션(예전에 대표 단원으로 만든 빈 섹션)은 지운다.
 * - 관리자가 다른 이름의 섹션에 유닛을 넣어 둔 코스: 손대지 않는다(관리 도구의 '기본 단원으로 섹션 채우기'로 넣는다).
 */
export function applyBaseCurriculum(db: DatabaseSync, now = Date.now()): { added: number; skipped: string[] } {
  let added = 0;
  const skipped: string[] = [];
  const insert = db.prepare("INSERT INTO learn_sections (id, grade, subject, ord, title, description) VALUES (?, ?, ?, ?, ?, ?)");
  const reorder = db.prepare("UPDATE learn_sections SET ord = ?, description = CASE WHEN description = '' THEN ? ELSE description END WHERE id = ?");
  const remove = db.prepare("DELETE FROM learn_sections WHERE id = ?");
  for (const course of BASE_COURSES) {
    const key = subjectKey(db, course, true, now)!;
    const existing = sectionsOf(db, course.grade, key);
    const titles = new Set(course.sections.map((s) => s[1]));
    if (existing.some((s) => s.units > 0 && !titles.has(s.title))) {
      skipped.push(`${course.grade}:${course.subject}`);
      continue;
    }
    const byTitle = new Map(existing.map((s) => [s.title, s]));
    for (const s of existing) if (!titles.has(s.title)) remove.run(s.id);
    course.sections.forEach((section, i) => {
      const desc = baseSectionDescription(course, section);
      const have = byTitle.get(section[1]);
      if (have) reorder.run(i, desc, have.id);
      else {
        insert.run(crypto.randomUUID(), course.grade, key, i, section[1], desc);
        added++;
      }
    });
  }
  return { added, skipped };
}

/**
 * 관리 도구: 한 코스에 기본 단원 중 빠진 섹션만 끝에 덧붙인다(이미 있는 섹션은 그대로, 빈 설명만 채운다).
 * 기본 단원이 없는 과목이면 null.
 */
export function fillCourseFromBase(db: DatabaseSync, grade: GradeId, subject: string, subjectName: string): { added: number; course: BaseCourse } | null {
  const course = BASE_COURSES.find((c) => c.grade === grade && (c.subject === subject || c.subject === subjectName));
  if (!course) return null;
  const existing = sectionsOf(db, grade, subject);
  const byTitle = new Map(existing.map((s) => [s.title, s]));
  const max = Number((db.prepare("SELECT COALESCE(MAX(ord), -1) AS m FROM learn_sections WHERE grade = ? AND subject = ?").get(grade, subject) as { m: number }).m);
  const insert = db.prepare("INSERT INTO learn_sections (id, grade, subject, ord, title, description) VALUES (?, ?, ?, ?, ?, ?)");
  const describe = db.prepare("UPDATE learn_sections SET description = ? WHERE id = ? AND description = ''");
  let added = 0;
  for (const section of course.sections) {
    const desc = baseSectionDescription(course, section);
    const have = byTitle.get(section[1]);
    if (have) describe.run(desc, have.id);
    else insert.run(crypto.randomUUID(), grade, subject, max + 1 + added++, section[1], desc);
  }
  return { added, course };
}
