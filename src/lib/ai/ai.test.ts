import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockModel } from "./mock";
import { fixNewlines, makeMaterial, makeQuiz, normalizeQuestion, parseWebAnswer, isRetryable, sleeper, startTutorStream, toModelMessages, tutorStream, withFallback } from "./service";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};
function jsonModel(...responses: unknown[]) {
  let i = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(responses[Math.min(i++, responses.length - 1)]) }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

const q = (over: Partial<Parameters<typeof normalizeQuestion>[0] & { figure: string }> = {}) => ({
  type: "multiple" as const,
  prompt: "1+1은?",
  choices: ["1", "2", "3", "4"],
  answer: "2",
  explanation: "",
  concept: "덧셈",
  ...over,
});

describe("normalizeQuestion", () => {
  it("keeps exact answers", () => {
    expect(normalizeQuestion(q())?.answer).toBe("2");
  });
  it("maps circled numbers and 'n번' to the choice text", () => {
    expect(normalizeQuestion(q({ choices: ["가", "나", "다", "라"], answer: "③" }))?.answer).toBe("다");
    expect(normalizeQuestion(q({ choices: ["가", "나", "다", "라"], answer: "2번" }))?.answer).toBe("나");
  });
  it("strips numbering from choices and answer", () => {
    const n = normalizeQuestion(q({ choices: ["① 사과", "② 배", "③ 감"], answer: "② 배" }));
    expect(n).toMatchObject({ choices: ["사과", "배", "감"], answer: "배" });
  });
  it("prefers a literal numeric choice over an index", () => {
    expect(normalizeQuestion(q({ choices: ["1", "5", "6"], answer: "5" }))?.answer).toBe("5");
  });
  it("drops unanswerable or broken questions", () => {
    expect(normalizeQuestion(q({ answer: "7" }))).toBeNull();
    expect(normalizeQuestion(q({ choices: ["a", "a"] }))).toBeNull();
    expect(normalizeQuestion(q({ prompt: " " }))).toBeNull();
  });
  it("clears choices for non-multiple questions", () => {
    expect(normalizeQuestion(q({ type: "short", choices: ["x"] }))?.choices).toEqual([]);
  });
});

describe("parseWebAnswer", () => {
  it("splits the key points section", () => {
    const r = parseWebAnswer("## 개념\n설명\n\n## 핵심\n- 하나\n- 둘\n1. 셋", "광합성");
    expect(r).toEqual({ title: "광합성", summary: "## 개념\n설명", keyPoints: ["하나", "둘", "셋"] });
  });
  it("works without a key points section", () => {
    expect(parseWebAnswer("본문", "q").keyPoints).toEqual([]);
  });
});

describe("toModelMessages", () => {
  it("attaches images only to recent user messages", () => {
    const img = "data:image/png;base64,AAAA";
    const msgs = Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: `m${i}`, images: i % 2 ? undefined : [img] }));
    const out = toModelMessages(msgs);
    expect(typeof out[0].content).toBe("string"); // 오래된 메시지: 사진 제외
    expect(Array.isArray(out[6].content)).toBe(true);
    expect((out[6].content as { type: string; mediaType?: string }[])[1]).toMatchObject({ type: "file", mediaType: "image/png", data: "AAAA" });
  });
});

describe("service with mock model", () => {
  it("streams a tutor reply in hint mode", async () => {
    const r = tutorStream({ mode: "hint", grade: "고1", messages: [{ role: "user", content: "x^2-5x+6=0" }] }, mockModel());
    let text = "";
    for await (const t of r.textStream) text += t;
    expect(text).toContain("두 일차식의 곱");
  });

  it("makes a structured material from curriculum", async () => {
    const m = await makeMaterial({ kind: "curriculum", grade: "고1", course: "공통수학1", unit: "이차방정식" }, mockModel(), () => ({}));
    expect(m.title).toBe("이차방정식의 풀이");
    expect(m.keyPoints.length).toBeGreaterThan(0);
    expect(m.sources).toEqual([]);
  });

  it("makes a quiz and applies verification fixes", async () => {
    const quiz = { title: "t", questions: [q(), q({ prompt: "2+2는?", answer: "3" })] };
    const verify = { results: [{ index: 1, correct: false, fixedAnswer: "4", fixedExplanation: "2+2=4" }] };
    const r = await makeQuiz(
      { grade: "고1", material: "자료", count: 5, types: ["multiple"], difficulty: "normal", verify: true },
      jsonModel(quiz, verify),
    );
    expect(r.verified).toBe(true);
    expect(r.questions.map((x) => x.answer)).toEqual(["2", "4"]);
    expect(r.questions[1].explanation).toBe("2+2=4");
  });

  it("drops broken questions and respects the count", async () => {
    const quiz = { title: "t", questions: [q(), q({ answer: "없는 답" }), q(), q()] };
    const r = await makeQuiz({ grade: "고1", material: "자료", count: 2, types: ["multiple"], difficulty: "easy", verify: false }, jsonModel(quiz));
    expect(r.questions).toHaveLength(2);
    expect(r.verified).toBe(false);
  });
});

describe("daily usage", () => {
  it("counts per feature, refunds, and resets on a new Seoul day", async () => {
    vi.stubEnv("AI_LIMIT_QUIZ", "2");
    vi.resetModules();
    const u = await import("./usage");
    const cwd = process.cwd();
    process.chdir(mkdtempSync(path.join(tmpdir(), "hs-")));
    const day1 = new Date("2026-11-09T05:00:00Z"); // 서울 14시
    expect(await u.consume("quiz", day1)).toBe(true);
    expect(await u.consume("quiz", day1)).toBe(true);
    expect(await u.consume("quiz", day1)).toBe(false);
    await u.refund("quiz", day1);
    expect(await u.consume("quiz", day1)).toBe(true);
    // 서울 자정이 지나면 초기화 (UTC 15시 = 서울 0시)
    expect(await u.consume("quiz", new Date("2026-11-09T15:30:00Z"))).toBe(true);
    // 파일에서 다시 읽어도 유지
    u.resetUsageMemory();
    const usage = await u.getUsage(new Date("2026-11-09T16:00:00Z"));
    expect(usage.find((x) => x.feature === "quiz")).toMatchObject({ used: 1, limit: 2 });
    expect(u.seoulDate(new Date("2026-11-09T15:30:00Z"))).toBe("2026-11-10");
    vi.unstubAllEnvs();
    process.chdir(cwd);
  });
});

describe("model fallback", () => {
  beforeEach(() => {
    vi.spyOn(sleeper, "sleep").mockResolvedValue(undefined);
  });

  it("retries a busy (429/503) model after a short wait before moving on", async () => {
    let calls = 0;
    const r = await withFallback(["a", "b"] as never, async () => {
      if (++calls < 3) throw Object.assign(new Error("Too Many Requests"), { statusCode: 429 });
      return "ok";
    });
    expect(r).toBe("ok");
    expect(calls).toBe(3);
    expect(sleeper.sleep).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sleeper.sleep).mock.calls[1][0]).toBeGreaterThan(vi.mocked(sleeper.sleep).mock.calls[0][0]);
  });

  it("gives up on a model after the retries and uses the next one", async () => {
    const tried: string[] = [];
    const r = await withFallback(["a", "b"] as never, async (m) => {
      tried.push(String(m));
      if (m === ("a" as never)) throw new Error("429 Too Many Requests");
      return "ok";
    });
    expect(r).toBe("ok");
    expect(tried).toEqual(["a", "a", "a", "b"]);
  });

  it("does not wait for errors a retry cannot fix", async () => {
    await expect(withFallback(["a"] as never, async () => Promise.reject(new Error("exceeded its monthly spending cap")))).rejects.toThrow("spending cap");
    expect(sleeper.sleep).not.toHaveBeenCalled();
    expect(isRetryable(Object.assign(new Error("exceeded its monthly spending cap"), { statusCode: 429 }))).toBe(false);
    expect(isRetryable(new Error("invalid api key 401"))).toBe(false);
    expect(isRetryable(new Error("503 UNAVAILABLE"))).toBe(true);
  });

  const failing = () =>
    new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("503 UNAVAILABLE: high demand");
      },
      doStream: async () => {
        throw new Error("503 UNAVAILABLE: high demand");
      },
    });

  it("moves to the next model when one fails, and throws the last error if all fail", async () => {
    const tried: string[] = [];
    const r = await withFallback(["a", "b", "c"] as never, async (m) => {
      tried.push(String(m));
      if (m !== ("c" as never)) throw new Error(`fail ${m}`);
      return "ok";
    });
    expect(r).toBe("ok");
    expect(tried).toEqual(["a", "b", "c"]);
    await expect(withFallback(["a", "b"] as never, async (m) => Promise.reject(new Error(`fail ${m}`)))).rejects.toThrow("fail b");
  });

  it("falls back for structured generation", async () => {
    const quiz = { title: "t", questions: [q()] };
    const r = await makeQuiz({ grade: "고1", material: "자료", count: 3, types: ["multiple"], difficulty: "easy", verify: false }, [failing(), jsonModel(quiz)]);
    expect(r.questions).toHaveLength(1);
  });

  it("starts the tutor stream on the first model that produces text", async () => {
    const { first, rest } = await startTutorStream({ mode: "solution", grade: "고1", messages: [{ role: "user", content: "풀이" }] }, [failing(), mockModel()]);
    let text = first;
    for (;;) {
      const next = await rest.next();
      if (next.done) break;
      if (next.value.type === "text-delta") text += next.value.text;
    }
    expect(text).toContain("정답:");
    await expect(startTutorStream({ mode: "hint", grade: "고1", messages: [{ role: "user", content: "x" }] }, [failing()])).rejects.toThrow("503");
  });
});

describe("output cleanup and web fallback", () => {
  beforeEach(() => {
    vi.spyOn(sleeper, "sleep").mockResolvedValue(undefined);
  });

  it("turns literal \\n into newlines but keeps LaTeX commands", () => {
    expect(fixNewlines("### 제목\\n내용\\n\\n* 목록")).toBe("### 제목\n내용\n\n* 목록");
    expect(fixNewlines("$a \\neq 0$, $\\nabla f$, $\\nu$")).toBe("$a \\neq 0$, $\\nabla f$, $\\nu$");
  });

  it("answers without search and says so when web search fails", async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        calls++;
        if (options.tools?.length) throw new Error("429 quota exceeded");
        return { content: [{ type: "text", text: "## 개념\\n설명\n\n## 핵심\n- 하나" }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
      },
    });
    const tools = { search: { type: "provider" as const, id: "x.search", args: {} } } as never;
    const m = await makeMaterial({ kind: "web", grade: "중2", query: "광합성" }, model, () => tools);
    // 검색은 붐빔 오류면 잠깐 기다렸다 2번 더 시도(3번), 그다음 검색 없이 1번
    expect(calls).toBe(4);
    expect(m.notice).toContain("웹 검색을 쓸 수 없어서");
    expect(m.sources).toEqual([]);
    expect(m.summary).toBe("## 개념\n설명");
    expect(m.keyPoints).toEqual(["하나"]);
  });
});

describe("그림(SVG) 문제", () => {
  it("그림은 저장 함수에 넘기고 문제 글 끝에 마크다운 그림으로 붙인다", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
    const quiz = { title: "t", questions: [q({ figure: svg }), q()] };
    const saved: string[] = [];
    const r = await makeQuiz(
      { grade: "고1", material: "자료", count: 5, types: ["multiple"], difficulty: "normal", verify: false },
      jsonModel(quiz),
      (s, alt) => (saved.push(s), `![${alt}](/api/media?id=x)`),
    );
    expect(saved).toEqual([svg]);
    expect(r.questions[0].prompt).toBe("1+1은?\n\n![문제 그림](/api/media?id=x)");
    expect(r.questions[1].prompt).toBe("1+1은?");
    expect("figure" in r.questions[0]).toBe(false);
  });

  it("저장 함수가 없으면 그림은 버린다", async () => {
    const r = await makeQuiz({ grade: "고1", material: "자료", count: 5, types: ["multiple"], difficulty: "normal", verify: false }, jsonModel({ title: "t", questions: [q({ figure: "<svg></svg>" })] }));
    expect(r.questions[0].prompt).toBe("1+1은?");
  });

  it("가짜 AI의 퀴즈와 유닛에도 그림이 들어 있다", async () => {
    const r = await makeQuiz({ grade: "고1", material: "자료", count: 5, types: ["multiple", "short"], difficulty: "normal", verify: false }, mockModel(), () => "![문제 그림](/api/media?id=m)");
    expect(r.questions.filter((x) => x.prompt.includes("/api/media?id=m"))).toHaveLength(1);
  });
});
