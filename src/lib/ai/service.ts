import { generateText, isStepCount, Output, streamText, type LanguageModel, type ModelMessage, type ToolSet } from "ai";
import {
  coachPrompt,
  feedbackPrompt,
  materialFromCurriculumPrompt,
  materialFromImagesPrompt,
  materialFromPdfPrompt,
  quizPrompt,
  tutorSystem,
  verifyPrompt,
  webSearchPrompt,
} from "./prompts";
import {
  CoachSchema,
  FeedbackSchema,
  MaterialSchema,
  QuizSchema,
  VerifySchema,
  type MaterialOutput,
  type MaterialRequest,
  type QuestionOutput,
  type QuizRequest,
  type TutorRequest,
  type CoachRequest,
  type FeedbackRequest,
} from "./schemas";

/**
 * 일부 모델은 구조화된 응답 안의 줄바꿈을 글자 그대로 "\\n"으로 보낸다. 진짜 줄바꿈으로 바꾼다.
 * 수식 명령(\\neq, \\nabla, \\nu …)은 건드리지 않도록 뒤에 영문자가 오면 그대로 둔다.
 */
export function fixNewlines(text: string): string {
  return text.replace(/\\n(?![a-zA-Z])/g, "\n").replace(/\\t(?![a-zA-Z])/g, " ");
}

function fixDeep<T>(value: T): T {
  if (typeof value === "string") return fixNewlines(value) as T;
  if (Array.isArray(value)) return value.map(fixDeep) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixDeep(v)])) as T;
  return value;
}

/** data:<type>;base64,<data> → SDK 파일 조각 */
export function dataUrlPart(dataUrl: string) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("bad data url");
  return { type: "file" as const, mediaType: m[1], data: m[2] };
}

/** 이미지는 최근 6개 메시지 안의 것만 보낸다 (요청 크기와 비용 절약) */
export function toModelMessages(messages: TutorRequest["messages"]): ModelMessage[] {
  const keepImagesFrom = messages.length - 6;
  return messages.map((m, i) => {
    if (m.role === "assistant") return { role: "assistant", content: m.content };
    const images = i >= keepImagesFrom ? (m.images ?? []) : [];
    if (images.length === 0) return { role: "user", content: m.content || "(사진 참고)" };
    return {
      role: "user",
      content: [{ type: "text", text: m.content || "이 사진 속 문제를 도와줘." }, ...images.map(dataUrlPart)],
    };
  });
}

/** 모델 하나 또는 '먼저 쓸 모델 → 대신 쓸 모델' 순서의 목록 */
export type Models = LanguageModel | LanguageModel[];
type ProviderOptions = NonNullable<Parameters<typeof streamText>[0]["providerOptions"]>;

/** 한 번의 요청이 끝없이 기다리지 않도록 하는 제한 */
const REQUEST_LIMITS = { maxRetries: 1, timeout: { totalMs: 75_000 } } as const;

/**
 * 모델을 순서대로 시도한다. AI 회사 쪽이 붐비거나(503) 모델이 없어졌을 때
 * 다음 모델로 넘어가서, 한 모델의 장애 때문에 기능 전체가 멈추지 않게 한다.
 */
export async function withFallback<T>(models: Models, run: (model: LanguageModel) => Promise<T>): Promise<T> {
  const list = Array.isArray(models) ? models : [models];
  let lastError: unknown = new Error("no model");
  for (const model of list) {
    try {
      return await run(model);
    } catch (e) {
      lastError = e;
      console.error("[ai] model failed, trying next:", typeof model === "string" ? model : model.modelId, e instanceof Error ? e.message.slice(0, 200) : e);
    }
  }
  throw lastError;
}

export function tutorStream(req: TutorRequest, model: LanguageModel, providerOptions?: ProviderOptions) {
  return streamText({
    model,
    system: tutorSystem(req.mode, req.grade, req.subject),
    messages: toModelMessages(req.messages),
    // 생각하는 모델은 생각에도 출력 토큰을 쓰므로 넉넉하게
    maxOutputTokens: 4000,
    maxRetries: 0,
    // 첫 글자까지 25초, 글자 사이 20초, 전체 2분
    timeout: { firstChunkMs: 25_000, chunkMs: 20_000, totalMs: 120_000 },
    providerOptions,
    onError: () => {
      // 오류는 스트림을 읽는 쪽에서 처리한다 (기본 동작인 콘솔 출력 생략)
    },
  });
}

/**
 * 튜터 답변을 시작한다. 첫 글자가 나올 때까지 기다렸다가 { first, rest }를 돌려준다.
 * 그 전에 오류가 나거나 빈 답이면 다음 모델로 넘어간다.
 */
export async function startTutorStream(req: TutorRequest, models: Models, providerOptions?: ProviderOptions) {
  return withFallback(models, async (model) => {
    const parts = tutorStream(req, model, providerOptions).fullStream[Symbol.asyncIterator]();
    for (;;) {
      const next = await parts.next();
      if (next.done) throw new Error("AI가 빈 답을 보냈어요.");
      if (next.value.type === "error") throw next.value.error;
      if (next.value.type === "text-delta" && next.value.text) return { first: next.value.text, rest: parts };
    }
  });
}

export interface MaterialResult extends MaterialOutput {
  sources: { title: string; url: string }[];
  /** 학생에게 알릴 점 (예: 웹 검색 없이 정리함) */
  notice?: string;
}

/** 웹 검색 답변(마크다운)에서 '## 핵심' 아래 목록을 핵심 정리로 뽑는다 */
export function parseWebAnswer(text: string, query: string): MaterialOutput {
  const m = text.match(/\n#{1,3}\s*핵심[^\n]*\n([\s\S]*)$/);
  const keyPoints = m
    ? m[1]
        .split("\n")
        .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 7)
    : [];
  const summary = (m ? text.slice(0, m.index) : text).trim();
  return { title: query.slice(0, 30), summary, keyPoints };
}

export async function makeMaterial(req: MaterialRequest, models: Models, webSearch: () => ToolSet): Promise<MaterialResult> {
  if (req.kind === "web") {
    // 검색 도구와 구조화 출력은 함께 못 쓰는 모델이 있어서, 마크다운으로 받고 나눈다
    try {
      const result = await withFallback(models, (model) =>
        generateText({
          model,
          tools: webSearch(),
          stopWhen: isStepCount(4),
          prompt: webSearchPrompt(req.grade, req.query, req.subject),
          maxOutputTokens: 6000,
          ...REQUEST_LIMITS,
        }),
      );
      const seen = new Set<string>();
      const sources = result.sources
        .filter((s): s is Extract<typeof s, { sourceType: "url" }> => s.sourceType === "url")
        .filter((s) => !seen.has(s.url) && seen.add(s.url))
        .map((s) => ({ title: s.title || new URL(s.url).hostname, url: s.url }))
        .slice(0, 8);
      return { ...parseWebAnswer(fixNewlines(result.text), req.query), sources };
    } catch (e) {
      // 웹 검색을 쓸 수 없을 때(요금제 한도 등): 검색 없이 AI가 아는 내용으로 정리하고 그 사실을 알린다
      console.error("[ai] web search unavailable, answering without search:", e instanceof Error ? e.message.slice(0, 160) : e);
      const result = await withFallback(models, (model) =>
        generateText({ model, prompt: webSearchPrompt(req.grade, req.query, req.subject, false), maxOutputTokens: 6000, ...REQUEST_LIMITS }),
      );
      return {
        ...parseWebAnswer(fixNewlines(result.text), req.query),
        sources: [],
        notice: "지금은 웹 검색을 쓸 수 없어서 AI가 아는 내용으로 정리했어요. 출처가 없으니 교과서로 꼭 확인하세요.",
      };
    }
  }

  const messages: ModelMessage[] =
    req.kind === "photo"
      ? [{ role: "user", content: [{ type: "text", text: "이 사진들의 내용을 정리해 줘." }, ...req.images.map(dataUrlPart)] }]
      : req.kind === "pdf"
        ? [{ role: "user", content: [{ type: "text", text: "이 PDF의 내용을 정리해 줘." }, { ...dataUrlPart(req.pdf), filename: "material.pdf" }] }]
        : [{ role: "user", content: `${req.course} - ${req.unit} 단원을 정리해 줘.` }];
  const system =
    req.kind === "photo"
      ? materialFromImagesPrompt(req.grade, req.subject)
      : req.kind === "pdf"
        ? materialFromPdfPrompt(req.grade, req.subject)
        : materialFromCurriculumPrompt(req.grade, req.course, req.unit);
  const { output } = await withFallback(models, (model) =>
    generateText({ model, system, messages, output: Output.object({ schema: MaterialSchema }), maxOutputTokens: 8000, ...REQUEST_LIMITS }),
  );
  return { ...fixDeep(output), sources: [] };
}

const CIRCLED = "①②③④⑤⑥";

/**
 * 객관식 정답을 보기와 맞춘다. 모델이 "③", "3번", "3) 내용"처럼 답해도 보기의 글자로 바꾸고,
 * 끝내 맞출 수 없는 문제는 버린다.
 */
export function normalizeQuestion(q: QuestionOutput): QuestionOutput | null {
  const prompt = q.prompt.trim();
  const answer = q.answer.trim();
  if (!prompt || !answer) return null;
  if (q.type !== "multiple") return { ...q, prompt, answer, choices: [] };
  const choices = q.choices.map((c) => c.replace(/^\s*(?:[①-⑥]|\(?[1-6][).]|[1-6]번)\s*/, "").trim()).filter(Boolean);
  if (choices.length < 2 || new Set(choices).size !== choices.length) return null;
  const stripped = answer.replace(/^\s*(?:[①-⑥]|\(?[1-6][).]|[1-6]번)\s*/, "").trim();
  let fixed = choices.find((c) => c === answer || c === stripped);
  if (!fixed) {
    const idx = CIRCLED.indexOf(answer[0]);
    const num = idx >= 0 ? idx : /^[1-6](번)?$/.test(answer) ? Number(answer[0]) - 1 : -1;
    if (num >= 0 && num < choices.length && !choices.includes(answer)) fixed = choices[num];
  }
  return fixed ? { ...q, prompt, choices, answer: fixed } : null;
}

export async function makeQuiz(req: QuizRequest, models: Models) {
  const { output } = await withFallback(models, (model) =>
    generateText({
      model,
      prompt: quizPrompt(req),
      output: Output.object({ schema: QuizSchema }),
      maxOutputTokens: 12_000,
      ...REQUEST_LIMITS,
    }),
  );
  let questions = fixDeep(output.questions).map(normalizeQuestion).filter((q): q is QuestionOutput => !!q).slice(0, req.count);
  let verified = false;

  if (req.verify && questions.length > 0) {
    try {
      const { output: check } = await withFallback(models, (model) =>
        generateText({
          model,
          prompt: verifyPrompt(questions),
          output: Output.object({ schema: VerifySchema }),
          maxOutputTokens: 8000,
          ...REQUEST_LIMITS,
        }),
      );
      questions = questions
        .map((q, i) => {
          const r = check.results.find((x) => x.index === i);
          if (!r || r.correct || !r.fixedAnswer.trim()) return q;
          return normalizeQuestion({ ...q, answer: fixNewlines(r.fixedAnswer), explanation: fixNewlines(r.fixedExplanation) || q.explanation });
        })
        .filter((q): q is QuestionOutput => !!q);
      verified = true;
    } catch {
      // 검산이 실패해도 문제는 그대로 준다
    }
  }
  return { title: output.title.trim() || "AI 퀴즈", questions, verified };
}

export async function makeFeedback(req: FeedbackRequest, models: Models) {
  const { output } = await withFallback(models, (model) =>
    generateText({ model, prompt: feedbackPrompt(req), output: Output.object({ schema: FeedbackSchema }), maxOutputTokens: 6000, ...REQUEST_LIMITS }),
  );
  return { ...fixDeep(output), score: Math.max(0, Math.min(100, Math.round(output.score))) };
}

/** 주간 코칭. 목록에 없는 학습법 추천은 버린다. */
export async function makeCoaching(req: CoachRequest, models: Models) {
  const { output } = await withFallback(models, (model) =>
    generateText({ model, prompt: coachPrompt(req), output: Output.object({ schema: CoachSchema }), maxOutputTokens: 8000, ...REQUEST_LIMITS }),
  );
  const ids = new Set(req.methods.map((m) => m.id));
  const seen = new Set<string>();
  return {
    ...fixDeep(output),
    recommendations: output.recommendations.filter((r) => ids.has(r.methodId) && !seen.has(r.methodId) && seen.add(r.methodId)).slice(0, 3),
  };
}
