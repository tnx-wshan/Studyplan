import { beforeEach, describe, expect, it } from "vitest";
import { openMemoryDb, serverDb } from "./db";
import { importUnits } from "./learn-import";
import { courseOutline, getUnit } from "./learn";
import { flattenImport, readImportText, toGrade, toSubject } from "@/lib/learn/import";
import { agentPrompt } from "@/data/learn/agentPrompt";

beforeEach(() => {
  openMemoryDb();
});

const good = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  steps: [
    { type: "summary", title: "정리", body: "본문", points: ["점"], ...extra },
    { type: "choice", prompt: "q", choices: ["가", "나", "다"], answer: "나", explanation: "" },
    { type: "short", prompt: "q2", answer: "3", explanation: "" },
  ],
});

describe("일괄 넣기: 읽기", () => {
  it("```json 감싸기와 앞뒤 설명 글을 떼어 낸다", () => {
    expect(readImportText('여기 있어요:\n```json\n{"units": []}\n```\n끝').data).toEqual({ units: [] });
    expect(readImportText("설명 [1, 2] 끝").data).toEqual([1, 2]);
    expect(readImportText("그냥 글").error).toMatch(/JSON을 찾지/);
    expect(readImportText("{ 깨짐").error).toMatch(/JSON을 찾지|올바르지/);
  });

  it("학년·과목은 id, 이름, 줄임말 모두 받는다", () => {
    expect(toGrade("m1")).toBe("m1");
    expect(toGrade("중학교 1학년")).toBe("m1");
    expect(toGrade("고 2")).toBe("h2");
    expect(toGrade("대학")).toBeNull();
    expect(toSubject("수학")).toBe("math");
    expect(toSubject("science")).toBe("science");
  });

  it("코스 배열을 유닛으로 펼치고, 빠진 값을 유닛마다 알려준다", () => {
    const { units, problems } = flattenImport([
      { grade: "m1", subject: "math", section: "A", units: [good("u1"), { ...good("u2"), section: "B" }] },
      { grade: "x", subject: "math", units: [{ steps: [] }] },
      { grade: "m1" },
    ]);
    expect(units.map((u) => [u.where, u.section])).toEqual([
      ["1-1", "A"],
      ["1-2", "B"],
      ["2-1", ""],
    ]);
    expect(units[2].problems.join(" ")).toMatch(/학년.*섹션.*유닛 이름.*단계/);
    expect(problems).toEqual(['3번째 코스: "units" 배열이 없어요.']);
  });
});

describe("일괄 넣기: 넣기", () => {
  const data = {
    grade: "m1",
    subject: "math",
    section: "소인수분해",
    units: [
      good("새 유닛 1"),
      good("소수와 합성수"), // 예제에 이미 있는 이름
      { title: "잘못된 유닛", steps: [{ type: "choice", prompt: "q", choices: ["a", "b"], answer: "c" }] },
      { ...good("새 섹션 유닛", { figure: '<svg viewBox="0 0 10 10"><script>x</script><circle r="3"/></svg>' }), section: "새로운 섹션" },
      good("새 유닛 1"), // 같은 묶음 안의 중복
    ],
  };

  it("검사만 하면 아무것도 바꾸지 않는다", () => {
    const before = courseOutline("m1", "math", true);
    const r = importUnits(data, { apply: false });
    expect(r.applied).toBe(false);
    expect(r.rows.map((x) => x.status)).toEqual(["ok", "duplicate", "error", "ok", "duplicate"]);
    expect(r.rows[2].problems[0]).toMatch(/보기에 없어요/);
    expect(r.rows[3]).toMatchObject({ newSection: true, figures: 1, steps: 3, questions: 2 });
    expect(courseOutline("m1", "math", true)).toEqual(before);
    expect((serverDb().prepare("SELECT COUNT(*) AS n FROM media").get() as { n: number }).n).toBe(0);
  });

  it("넣으면 문제 없는 유닛만 초안으로 넣고, 섹션을 만들고, 그림을 저장한다", () => {
    const r = importUnits(data, { apply: true });
    expect(r).toMatchObject({ applied: true, added: 2, sectionsAdded: 1 });
    const outline = courseOutline("m1", "math", true);
    const first = outline.sections.find((s) => s.title === "소인수분해")!;
    expect(first.units.map((u) => [u.title, u.status]).slice(-1)).toEqual([["새 유닛 1", "draft"]]);
    const added = outline.sections.at(-1)!;
    expect(added.title).toBe("새로운 섹션");
    const unit = getUnit(added.units[0].id, true)!;
    expect(unit.steps[0]).toMatchObject({ type: "summary" });
    expect((unit.steps[0] as { body: string }).body).toMatch(/^본문\n\n!\[정리\]\(\/api\/media\?id=/);
    // 학생에게는 아직 보이지 않는다
    expect(courseOutline("m1", "math").sections.at(-1)!.units).toEqual([]);
    // 같은 내용을 다시 넣으면 모두 '이미 있음'
    expect(importUnits(data, { apply: true }).added).toBe(0);
  });

  it("바로 공개로 넣을 수 있다", () => {
    importUnits({ grade: "h1", subject: "science", section: "물질", units: [good("원소")] }, { apply: true, status: "published" });
    expect(courseOutline("h1", "science").sections[0].units.map((u) => u.title)).toEqual(["원소"]);
  });
});

describe("AI 에이전트용 지시문", () => {
  it("코스·섹션·이미 있는 유닛과 형식 규칙이 들어간다", () => {
    const p = agentPrompt({ grade: "m1", subject: "math", section: "소인수분해", count: 10, existing: ["소수와 합성수"] });
    expect(p).toContain("중학교 1학년 수학 과목의 '소인수분해' 섹션에 들어갈 학습 유닛을 10개");
    expect(p).toContain("겹치지 않게 해: 소수와 합성수");
    expect(p).toContain('"grade": "m1"');
    expect(p).toContain(String.raw`$2^2 \\times 3$`);
    expect(p).toContain('"math": true');
    expect(agentPrompt({ grade: "h1", subject: "korean", section: "문학", count: 5, existing: [] })).not.toContain('"math": true');
  });
});
