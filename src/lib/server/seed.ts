import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { SAMPLE_COURSES } from "@/data/learn/samples";
import { estimateMinutes } from "@/lib/learn/check";

/**
 * 처음 만든 서버 DB에 예제 유닛을 넣는다. 예제 유닛은 바로 공개 상태다.
 * 섹션은 기본 단원(마이그레이션 6)에서 이름으로 찾고, 없으면 코스 끝에 만든다. 유닛이 없는 예제 섹션은 만들지 않는다.
 */
export function seedLearn(db: DatabaseSync, now = Date.now()) {
  const addSection = db.prepare("INSERT INTO learn_sections (id, grade, subject, ord, title, description) VALUES (?, ?, ?, ?, ?, '')");
  const findSection = db.prepare("SELECT id FROM learn_sections WHERE grade = ? AND subject = ? AND title = ?");
  const maxOrd = db.prepare("SELECT COALESCE(MAX(ord), -1) AS m FROM learn_sections WHERE grade = ? AND subject = ?");
  const addUnit = db.prepare(
    "INSERT INTO learn_units (id, section_id, ord, title, minutes, status, steps, source_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'published', ?, '[]', ?, ?)",
  );
  for (const course of SAMPLE_COURSES) {
    const ids = new Map<string, string>();
    const used = new Set(course.units.map((u) => u.section));
    for (const title of course.sections.filter((t) => used.has(t))) {
      const found = findSection.get(course.grade, course.subject, title) as { id: string } | undefined;
      if (found) {
        ids.set(title, found.id);
        continue;
      }
      const id = crypto.randomUUID();
      ids.set(title, id);
      addSection.run(id, course.grade, course.subject, Number((maxOrd.get(course.grade, course.subject) as { m: number }).m) + 1, title);
    }
    const order = new Map<string, number>();
    for (const unit of course.units) {
      const sectionId = ids.get(unit.section);
      if (!sectionId) continue;
      const ord = order.get(sectionId) ?? 0;
      order.set(sectionId, ord + 1);
      addUnit.run(crypto.randomUUID(), sectionId, ord, unit.title, estimateMinutes(unit.steps), JSON.stringify(unit.steps), now, now);
    }
  }
}
