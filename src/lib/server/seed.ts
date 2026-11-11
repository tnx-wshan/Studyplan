import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { SAMPLE_COURSES } from "@/data/learn/samples";
import { estimateMinutes } from "@/lib/learn/check";

/** 처음 만든 서버 DB에 예제 코스(섹션과 유닛)를 넣는다. 예제 유닛은 바로 공개 상태다 */
export function seedLearn(db: DatabaseSync, now = Date.now()) {
  const addSection = db.prepare("INSERT INTO learn_sections (id, grade, subject, ord, title, description) VALUES (?, ?, ?, ?, ?, '')");
  const addUnit = db.prepare(
    "INSERT INTO learn_units (id, section_id, ord, title, minutes, status, steps, source_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'published', ?, '[]', ?, ?)",
  );
  for (const course of SAMPLE_COURSES) {
    const ids = new Map<string, string>();
    course.sections.forEach((title, i) => {
      const id = crypto.randomUUID();
      ids.set(title, id);
      addSection.run(id, course.grade, course.subject, i, title);
    });
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
