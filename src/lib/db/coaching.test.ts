import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { QUESTIONS } from "@/data/diagnosis";
import { makeCoaching, makeFeedback } from "@/lib/ai/service";
import { mockModel } from "@/lib/ai/mock";
import { reportToText } from "@/lib/study/coachText";
import { computeReport } from "@/lib/study/report";
import { weekPeriod } from "@/lib/study/period";
import { HomeStudyDB, getDB, setDB } from "./index";
import { addMethodLog, loadReportInput, saveCoachReport, saveDiagnosis, saveReflection } from "./coaching";
import { completeOnboarding, getProfile } from "./profile";

let n = 0;
beforeEach(async () => {
  setDB(new HomeStudyDB(`coach-${n++}`));
  await completeOnboarding({ nickname: "a", grade: "m2", goal: "", petSpecies: "flame", petName: "b" });
});

const at = (d: string, h = 12) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00`).getTime();

describe("coaching storage", () => {
  it("saves diagnosis scores on the profile", async () => {
    await saveDiagnosis(Object.fromEntries(QUESTIONS.map((q) => [q.id, 3])));
    expect((await getProfile())?.diagnosis?.scores.plan).toBe(50);
  });

  it("gives method xp once per method per day", async () => {
    expect((await addMethodLog({ methodId: "blank", fields: { text: "a" } }, at("2026-11-09", 9))).xp).toBe(150);
    expect((await addMethodLog({ methodId: "blank", fields: { text: "b" } }, at("2026-11-09", 20))).xp).toBe(0);
    expect((await addMethodLog({ methodId: "feynman", fields: {} }, at("2026-11-09", 21))).xp).toBe(150);
    expect((await addMethodLog({ methodId: "blank", fields: {} }, at("2026-11-10", 9))).xp).toBe(150);
    expect((await getProfile())?.totalXp).toBe(450);
    expect(await getDB().methodLogs.count()).toBe(4);
  });

  it("gives reflection xp once per week and keeps edits", async () => {
    expect(await saveReflection("2026-W46", { good: "a", bad: "b", nextGoal: "c", mood: 4 })).toBe(200);
    expect(await saveReflection("2026-W46", { good: "a2", bad: "b", nextGoal: "c" })).toBe(0);
    expect((await getDB().reflections.get("2026-W46"))?.good).toBe("a2");
    expect((await getProfile())?.totalXp).toBe(200);
  });

  it("stores coach reports and loads report input", async () => {
    await saveCoachReport({ period: "2026-W46", summary: "s", strengths: [], improvements: [], recommendations: [], goals: [], madeBy: "x" });
    expect(await getDB().coachReports.where("period").equals("2026-W46").count()).toBe(1);
    await addMethodLog({ methodId: "blank", fields: {} }, at("2026-11-10"));
    const input = await loadReportInput();
    const r = computeReport(input, weekPeriod("2026-W46"));
    expect(r.methodPractices).toEqual([{ methodId: "blank", count: 1 }]);
    expect(r.xp).toBe(150);
  });
});

describe("coaching AI (mock)", () => {
  it("filters unknown method recommendations", async () => {
    const r = await makeCoaching({ grade: "중2", periodLabel: "이번 주", stats: "기록", weakAreas: [], methods: [{ id: "spaced", name: "간격 반복" }] }, mockModel());
    expect(r.recommendations.map((x) => x.methodId)).toEqual(["spaced"]);
    expect(r.goals.length).toBeGreaterThan(0);
  });

  it("returns clamped feedback", async () => {
    const f = await makeFeedback({ kind: "feynman", grade: "중2", topic: "이차방정식", text: "설명" }, mockModel());
    expect(f.score).toBe(72);
    expect(f.missing).toEqual(["근의 공식"]);
  });
});

describe("reportToText", () => {
  it("summarizes stats without personal data", async () => {
    const input = await loadReportInput();
    const p = weekPeriod("2026-W46");
    const text = reportToText(computeReport(input, p), computeReport(input, p), () => "수학");
    expect(text).toContain("공부한 날: 0/7일");
    expect(text).toContain("AI 퀴즈 정답률: 푼 퀴즈 없음");
  });
});
