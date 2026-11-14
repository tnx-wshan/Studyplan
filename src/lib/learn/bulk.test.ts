import { describe, expect, it } from "vitest";
import { mergeResults, packBatches, readBulkFiles, type ImportResult, type ImportRow } from "./bulk";
import { flattenImport } from "./import";

const unit = (title: string) => ({ title, steps: [{ type: "summary", title: "t", body: "b" }] });
const file = (name: string, text: string) => ({ name, size: text.length, text: async () => text });
const row = (title: string, extra: Partial<ImportRow> = {}): ImportRow => ({
  where: title,
  grade: "m1",
  subject: "math",
  section: "소인수분해",
  title,
  status: "ok",
  problems: [],
  steps: 1,
  questions: 0,
  figures: 0,
  newSection: false,
  ...extra,
});
const part = (rows: ImportRow[], extra: Partial<ImportResult> = {}): ImportResult => ({ rows, problems: [], applied: false, added: 0, sectionsAdded: 0, ...extra });

describe("대량 파일 올리기", () => {
  it("파일마다 읽어 코스로 펼치고, 읽지 못한 파일은 까닭을 남긴다. 결과 표에는 파일 이름이 보인다", async () => {
    const files = await readBulkFiles([
      file("a.json", JSON.stringify({ grade: "m1", subject: "math", section: "소인수분해", units: [unit("가"), unit("나")] })),
      file("b.json", "```json\n" + JSON.stringify([{ grade: "m1", subject: "math", section: "정수", units: [unit("다")] }]) + "\n```"),
      file("c.json", "{ 깨진"),
    ]);
    expect(files.map((f) => [f.name, f.courses.length, f.units, !!f.error])).toEqual([
      ["a.json", 1, 2, false],
      ["b.json", 1, 1, false],
      ["c.json", 0, 0, true],
    ]);
    const flat = flattenImport(files.flatMap((f) => f.courses));
    expect(flat.units.map((u) => u.where)).toEqual(["a.json #1", "a.json #2", "b.json #1"]);
  });

  it("묶음은 글자 수·유닛 수를 넘지 않게 나누고, 유닛이 많은 코스는 쪼갠다", () => {
    const big = { grade: "m1", subject: "math", section: "S", units: Array.from({ length: 7 }, (_, i) => unit(`u${i}`)) };
    const small = { grade: "m1", subject: "math", section: "T", units: [unit("x")] };
    const batches = packBatches([big, small], 1_000_000, 3);
    expect(batches.map((b) => b.map((c) => (c.units as unknown[]).length))).toEqual([[3], [3], [1, 1]]);
    expect(batches[1][0]).toMatchObject({ section: "S" });
    // 글자 수로도 나눈다
    expect(packBatches([small, small, small], JSON.stringify(small).length * 2, 100).map((b) => b.length)).toEqual([2, 1]);
  });

  it("검사 결과를 합칠 때 앞 묶음과 같은 섹션·이름이면 '이미 있음', 숫자 붙이기면 다음 숫자, 새 섹션 표시는 한 번만", () => {
    const parts = [part([row("가", { newSection: true, section: "새" }), row("나")]), part([row("가", { section: "새", newSection: true }), row("나"), row("다")])];
    const plain = mergeResults(parts, false);
    expect(plain.rows.map((r) => [r.title, r.status, r.newSection])).toEqual([
      ["가", "ok", true],
      ["나", "ok", false],
      ["가", "duplicate", false],
      ["나", "duplicate", false],
      ["다", "ok", false],
    ]);
    const renamed = mergeResults(parts, true);
    expect(renamed.rows.map((r) => [r.title, r.renamedFrom, r.newSection])).toEqual([
      ["가", undefined, true],
      ["나", undefined, false],
      ["가 1", "가", false],
      ["나 1", "나", false],
      ["다", undefined, false],
    ]);
    expect(renamed.rows[2].problems).toEqual(["같은 이름이 있어서 '가 1'(으)로 바꿔 넣어요."]);
  });

  it("넣기 결과는 서버가 앞 묶음을 넣은 뒤라 그대로 합치고 수를 더한다", () => {
    const merged = mergeResults([part([row("가")], { applied: true, added: 1, sectionsAdded: 1 }), part([row("가", { status: "duplicate" })], { applied: true, added: 0 })], false);
    expect(merged).toMatchObject({ applied: true, added: 1, sectionsAdded: 1 });
    expect(merged.rows.map((r) => r.status)).toEqual(["ok", "duplicate"]);
  });
});
