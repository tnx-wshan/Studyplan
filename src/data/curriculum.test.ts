import { describe, expect, it } from "vitest";
import { COURSES, GRADES, SUBJECT_GROUPS, coursesFor } from "./curriculum";

describe("curriculum", () => {
  it("has unique course ids", () => {
    const ids = COURSES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("covers all five subject groups for every grade", () => {
    for (const g of GRADES) {
      for (const s of SUBJECT_GROUPS) {
        expect(coursesFor(g.id, s.id).length, `${g.id} ${s.id}`).toBeGreaterThan(0);
      }
    }
  });
  it("has no duplicate units within a course", () => {
    for (const c of COURSES) expect(new Set(c.units).size, c.id).toBe(c.units.length);
  });
});
