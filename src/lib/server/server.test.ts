import { beforeEach, describe, expect, it } from "vitest";
import { openMemoryDb } from "./db";
import { addItem, duplicateGroups, findByKey, gradeId, listItems, materialLookupKey, quizLookupKey, similarity, subjectId, topicKey, updateItem } from "./bank";
import { courseOutline, createSection, createUnit, getUnit, listCourses, moveUnit, updateUnit } from "./learn";
import { addCommand, cancelCommand, getUser, isSuspended, syncUser, updateUser } from "./users";
import { unitSteps } from "@/lib/ai/service";

beforeEach(() => {
  openMemoryDb();
});

const snapshot = { level: 1, totalXp: 0, coins: 0, freezes: 0, streak: 0, longestStreak: 0, learnDone: [], learnTodaySec: 0, learnWeekSec: 0 };
const uid = "11111111-1111-4111-8111-111111111111";

describe("learn content", () => {
  it("seeds the sample course", () => {
    expect(listCourses()).toEqual([{ grade: "m1", subject: "math", units: 3 }]);
    const outline = courseOutline("m1", "math");
    expect(outline.sections[0].title).toBe("소인수분해");
    expect(outline.sections[0].units.map((u) => u.title)).toEqual(["소수와 합성수", "거듭제곱과 소인수분해"]);
    expect(outline.sections[0].units[0].questionCount).toBe(5);
  });

  it("keeps drafts hidden from students and validates steps", () => {
    const s = createSection("m2", "science", "물질의 구성");
    const bad = createUnit(s.id, { title: "x", steps: [{ type: "choice", prompt: "q", choices: ["a", "b"], answer: "c" }] });
    expect(bad.problems?.[0]).toMatch(/보기에 없어요/);
    const ok = createUnit(s.id, { title: "원소", steps: [{ type: "summary", title: "원소", body: "더 이상 나눌 수 없는 성분" }] });
    const id = ok.unit!.id;
    expect(courseOutline("m2", "science").sections[0].units).toEqual([]);
    expect(getUnit(id)).toBeNull();
    updateUnit(id, { status: "published" });
    expect(getUnit(id)?.status).toBe("published");
    expect(courseOutline("m2", "science").sections[0].units).toHaveLength(1);
  });

  it("reorders units", () => {
    const s = createSection("m2", "math", "연립방정식");
    const one = { type: "summary", title: "t", body: "b" };
    const a = createUnit(s.id, { title: "A", steps: [one], status: "published" }).unit!;
    const b = createUnit(s.id, { title: "B", steps: [one], status: "published" }).unit!;
    moveUnit(b.id, -1);
    expect(courseOutline("m2", "math").sections[0].units.map((u) => u.title)).toEqual(["B", "A"]);
    expect(a.order).toBe(0);
  });
});

describe("content bank", () => {
  it("recognizes the same request regardless of spacing", () => {
    expect(topicKey("광합성과 호흡의 차이?")).toBe(topicKey("광합성과호흡의 차이"));
    const k1 = materialLookupKey({ kind: "web", grade: "m1", subject: "science", topic: "광합성 " });
    const k2 = materialLookupKey({ kind: "web", grade: "m1", subject: "science", topic: "광합성" });
    expect(k1).toBe(k2);
    expect(quizLookupKey({ material: "x", count: 5, types: ["short", "multiple"], difficulty: "normal" })).toBe(quizLookupKey({ material: "x", count: 5, types: ["multiple", "short"], difficulty: "normal" }));
    expect(gradeId("중학교 1학년")).toBe("m1");
    expect(subjectId(undefined, "수학Ⅰ")).toBe("math");
  });

  it("serves saved items until hidden", () => {
    const key = materialLookupKey({ kind: "web", grade: "m1", subject: "science", topic: "광합성" });
    const item = addItem({ kind: "material", lookupKey: key, sourceKind: "web", grade: "m1", subject: "science", topic: "광합성", title: "광합성", data: { summary: "s", keyPoints: [], sources: [] } });
    expect(findByKey(key)?.id).toBe(item.id);
    updateItem(item.id, { status: "hidden" });
    expect(findByKey(key)).toBeNull();
    expect(listItems()).toHaveLength(0);
    expect(listItems({ includeHidden: true })[0].edited).toBe(true);
  });

  it("groups overlapping topics", () => {
    const add = (topic: string, subject = "science") =>
      addItem({ kind: "material", lookupKey: topic, sourceKind: "web", grade: "m1", subject, topic, title: topic, data: { summary: "", keyPoints: [], sources: [] } });
    add("광합성");
    add("광합성 과정");
    add("광합성", "math");
    add("지진과 화산");
    expect(similarity("광합성", "광합성 과정")).toBe(1);
    const groups = duplicateGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].map((x) => x.topic).sort()).toEqual(["광합성", "광합성 과정"]);
  });
});

describe("users and commands", () => {
  it("records snapshots and hands out pending commands until acknowledged", () => {
    expect(syncUser({ userId: uid, nickname: "민수", grade: "m1", snapshot, lastCommandId: 0 }).commands).toEqual([]);
    const c = addCommand(uid, { type: "setXp", payload: { totalXp: 300 } })!;
    expect(syncUser({ userId: uid, nickname: "민수", grade: "m1", snapshot, lastCommandId: 0 }).commands.map((x) => x.id)).toEqual([c.id]);
    // 적용했다고 알리면 다시 주지 않고, 적용됨으로 남는다
    expect(syncUser({ userId: uid, nickname: "민수", grade: "m1", snapshot, lastCommandId: c.id }).commands).toEqual([]);
    expect(getUser(uid)?.commands[0].appliedAt).not.toBeNull();
    // 적용된 명령은 취소할 수 없다
    expect(cancelCommand(uid, c.id)).toBe(false);
    // 다른 기기로 백업을 옮겨 lastCommandId가 0이어도 이미 적용된 명령은 다시 주지 않는다
    expect(syncUser({ userId: uid, nickname: "민수", grade: "m1", snapshot, lastCommandId: 0 }).commands).toEqual([]);
  });

  it("suspends users", () => {
    syncUser({ userId: uid, nickname: "민수", grade: "m1", snapshot, lastCommandId: 0 });
    expect(isSuspended(uid)).toBe(false);
    updateUser(uid, { status: "suspended" });
    expect(isSuspended(uid)).toBe(true);
    expect(syncUser({ userId: uid, nickname: "민수", grade: "m1", snapshot, lastCommandId: 0 }).status).toBe("suspended");
    expect(isSuspended(null)).toBe(false);
  });
});

describe("AI unit output", () => {
  it("converts and filters generated questions", () => {
    const { steps, problems } = unitSteps({
      title: "t",
      summaries: [{ title: "정리", body: "본문", points: [], figure: "" }],
      questions: [
        { type: "choice", prompt: "q", choices: ["a", "b"], answer: "a", accepted: [], text: "", distractors: [], explanation: "", figure: "" },
        { type: "choice", prompt: "q", choices: ["a", "b"], answer: "z", accepted: [], text: "", distractors: [], explanation: "", figure: "" },
        { type: "short", prompt: "q", choices: [], answer: "3", accepted: ["삼"], text: "", distractors: [], explanation: "", figure: "" },
        { type: "puzzle", prompt: "뜻", choices: [], answer: "엽 록 소", accepted: [], text: "", distractors: [], explanation: "", figure: "" },
      ],
    });
    expect(steps.map((s) => s.type)).toEqual(["summary", "choice", "short", "puzzle"]);
    expect(steps[2]).toMatchObject({ answers: ["3", "삼"] });
    expect(steps[3]).toMatchObject({ answer: "엽록소" });
    expect(problems).toHaveLength(1);
  });
});

describe("저장된 수식 명령 보정", () => {
  it("예전에 깨진 채 저장된 자료를 마이그레이션으로 고친다", async () => {
    const { repairJsonColumn, serverDb } = await import("./db");
    const db = serverDb();
    // 보정 없이 깨진 글자 그대로 넣는다 ("\t" = 탭 문자)
    db.prepare("INSERT INTO bank_items (id, kind, lookup_key, data, created_at, updated_at) VALUES ('q1', 'quiz', 'k', ?, 0, 0)").run(
      JSON.stringify({ questions: [{ prompt: "$12 = 2^2 \times 3$", choices: ["$\frac{1}{2}$"] }] }),
    );
    repairJsonColumn(db, "bank_items", "data");
    const row = db.prepare("SELECT data FROM bank_items WHERE id = 'q1'").get() as { data: string };
    expect(JSON.parse(row.data).questions[0]).toEqual({ prompt: String.raw`$12 = 2^2 \times 3$`, choices: [String.raw`$\frac{1}{2}$`] });
  });

  it("새로 저장하는 자료와 유닛도 고쳐서 저장한다", () => {
    const item = addItem({ kind: "material", lookupKey: "k2", sourceKind: "web", grade: "m1", subject: "math", topic: "t", title: "t", data: { summary: "$2 \times 3$", keyPoints: [], sources: [] } });
    expect((item.data as { summary: string }).summary).toBe(String.raw`$2 \times 3$`);
    const s = createSection("m1", "math", "새 섹션");
    const r = createUnit(s.id, { title: "u", steps: [{ type: "short", prompt: "$\frac{6}{3}$은?", answers: ["2"] }] });
    expect((r.unit!.steps[0] as { prompt: string }).prompt).toBe(String.raw`$\frac{6}{3}$은?`);
  });
});

describe("그림 저장", () => {
  it("SVG에서 스크립트·이벤트·외부 링크를 지운다", async () => {
    const { sanitizeSvg } = await import("./svg");
    const out = sanitizeSvg('```svg\n<svg viewBox="0 0 10 10" onload="x()"><script>alert(1)</script><a href="https://evil"><text>가</text></a><image xlink:href="http://x/y.png"/><use href="#p"/><foreignObject><div/></foreignObject><style>@import url(http://x);</style></svg>\n```')!;
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).not.toMatch(/script|onload|evil|http:\/\/x|foreignObject|@import/);
    expect(out).toContain('href="#p"');
    expect(sanitizeSvg("<div>그림 아님</div>")).toBeNull();
    expect(sanitizeSvg(`<svg>${"a".repeat(200_000)}</svg>`)).toBeNull();
  });

  it("같은 그림은 한 번만 저장하고, 쓸 수 없는 그림은 거절한다", async () => {
    const { figureMarkdown, getMedia, saveDataUrl, saveMedia } = await import("./media");
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const a = saveDataUrl(png, "admin")!;
    expect(saveDataUrl(png, "admin")).toBe(a);
    expect(getMedia(a)?.mime).toBe("image/png");
    expect(saveDataUrl("data:text/html;base64,PGI+", "admin")).toBeNull();
    expect(saveMedia("image/svg+xml", new TextEncoder().encode("<p>no</p>"), "ai")).toBeNull();
    const md = figureMarkdown('<svg viewBox="0 0 1 1"><script>x</script></svg>');
    expect(md).toMatch(/^!\[문제 그림\]\(\/api\/media\?id=[0-9a-f-]+\)$/);
    const id = md.match(/id=([0-9a-f-]+)/)![1];
    expect(new TextDecoder().decode(getMedia(id)!.data)).not.toContain("script");
    expect(figureMarkdown("")).toBe("");
  });

  it("AI 유닛의 그림은 정리와 문제에 붙는다", () => {
    const { steps } = unitSteps(
      {
        title: "t",
        summaries: [{ title: "정리", body: "본문", points: [], figure: "<svg/>" }],
        questions: [{ type: "choice", prompt: "q", choices: ["a", "b"], answer: "a", accepted: [], text: "", distractors: [], explanation: "", figure: "<svg/>" }],
      },
      (_svg, alt) => `![${alt}](/api/media?id=1)`,
    );
    expect(steps[0]).toMatchObject({ body: "본문\n\n![정리](/api/media?id=1)" });
    expect(steps[1]).toMatchObject({ prompt: "q\n\n![문제 그림](/api/media?id=1)" });
  });
});

describe("교과서 분류 (학년 · 과목 · 출판사 · 연도 · 단원)", () => {
  it("출판사·연도·단원을 저장하고 출판사로 거른다", async () => {
    const { listPublishers } = await import("./bank");
    const data = { summary: "s", keyPoints: [], sources: [] };
    addItem({ kind: "material", lookupKey: "a", sourceKind: "curriculum", grade: "m1", subject: "math", topic: "수학 소수", title: "소수", publisher: "천재교육", year: 2026, unit: "Ⅰ. 소인수분해 - 1. 소수와 합성수", data });
    addItem({ kind: "material", lookupKey: "b", sourceKind: "curriculum", grade: "m1", subject: "math", topic: "수학 소수", title: "소수", publisher: "비상교육", year: 2025, unit: "1. 소인수분해", data });
    expect(listItems({ publisher: "천재교육" }).map((x) => [x.publisher, x.year, x.unit])).toEqual([["천재교육", 2026, "Ⅰ. 소인수분해 - 1. 소수와 합성수"]]);
    expect(listItems({ q: "소수와 합성수" })).toHaveLength(1);
    expect(listPublishers()).toEqual(["비상교육", "천재교육"]);
    const id = listItems({ publisher: "비상교육" })[0].id;
    expect(updateItem(id, { publisher: "미래엔", year: null, unit: "2. 거듭제곱" })).toMatchObject({ publisher: "미래엔", year: null, unit: "2. 거듭제곱" });
  });

  it("출판사가 다르면 다른 자료로 본다", () => {
    const k1 = materialLookupKey({ kind: "curriculum", grade: "m1", subject: "math", topic: "수학 천재교육 2026 소수와 합성수" });
    const k2 = materialLookupKey({ kind: "curriculum", grade: "m1", subject: "math", topic: "수학 비상교육 2026 소수와 합성수" });
    expect(k1).not.toBe(k2);
  });

  it("지시문에 출판사·연도 교과서를 적는다", async () => {
    const { materialFromCurriculumPrompt } = await import("@/lib/ai/prompts");
    const p = materialFromCurriculumPrompt("중학교 1학년", "수학", "Ⅰ. 소인수분해", "천재교육", 2026);
    expect(p).toContain("'수학' 과목(천재교육 2026년 교과서)의 'Ⅰ. 소인수분해' 단원");
    expect(p).toContain("그대로 옮기지는 마");
    expect(materialFromCurriculumPrompt("중학교 1학년", "수학", "소수")).not.toContain("교과서)의");
  });
});
