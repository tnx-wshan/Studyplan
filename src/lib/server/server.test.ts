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
      summaries: [{ title: "정리", body: "본문", points: [] }],
      questions: [
        { type: "choice", prompt: "q", choices: ["a", "b"], answer: "a", accepted: [], text: "", distractors: [], explanation: "" },
        { type: "choice", prompt: "q", choices: ["a", "b"], answer: "z", accepted: [], text: "", distractors: [], explanation: "" },
        { type: "short", prompt: "q", choices: [], answer: "3", accepted: ["삼"], text: "", distractors: [], explanation: "" },
        { type: "puzzle", prompt: "뜻", choices: [], answer: "엽 록 소", accepted: [], text: "", distractors: [], explanation: "" },
      ],
    });
    expect(steps.map((s) => s.type)).toEqual(["summary", "choice", "short", "puzzle"]);
    expect(steps[2]).toMatchObject({ answers: ["3", "삼"] });
    expect(steps[3]).toMatchObject({ answer: "엽록소" });
    expect(problems).toHaveLength(1);
  });
});
