import { generateText, isStepCount, Output, streamText, type LanguageModel, type ModelMessage, type ToolSet } from "ai";
import {
  materialFromCurriculumPrompt,
  materialFromImagesPrompt,
  materialFromPdfPrompt,
  quizPrompt,
  tutorSystem,
  verifyPrompt,
  webSearchPrompt,
} from "./prompts";
import {
  MaterialSchema,
  QuizSchema,
  VerifySchema,
  type MaterialOutput,
  type MaterialRequest,
  type QuestionOutput,
  type QuizRequest,
  type TutorRequest,
} from "./schemas";

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

export function tutorStream(req: TutorRequest, model: LanguageModel) {
  return streamText({
    model,
    system: tutorSystem(req.mode, req.grade, req.subject),
    messages: toModelMessages(req.messages),
    maxOutputTokens: 1500,
  });
}

export interface MaterialResult extends MaterialOutput {
  sources: { title: string; url: string }[];
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

export async function makeMaterial(req: MaterialRequest, model: LanguageModel, webSearch: () => ToolSet): Promise<MaterialResult> {
  if (req.kind === "web") {
    // 검색 도구와 구조화 출력은 함께 못 쓰는 모델이 있어서, 마크다운으로 받고 나눈다
    const result = await generateText({
      model,
      tools: webSearch(),
      stopWhen: isStepCount(4),
      prompt: webSearchPrompt(req.grade, req.query, req.subject),
      maxOutputTokens: 3000,
    });
    const seen = new Set<string>();
    const sources = result.sources
      .filter((s): s is Extract<typeof s, { sourceType: "url" }> => s.sourceType === "url")
      .filter((s) => !seen.has(s.url) && seen.add(s.url))
      .map((s) => ({ title: s.title || new URL(s.url).hostname, url: s.url }))
      .slice(0, 8);
    return { ...parseWebAnswer(result.text, req.query), sources };
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
  const { output } = await generateText({ model, system, messages, output: Output.object({ schema: MaterialSchema }), maxOutputTokens: 4000 });
  return { ...output, sources: [] };
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

export async function makeQuiz(req: QuizRequest, model: LanguageModel) {
  const { output } = await generateText({
    model,
    prompt: quizPrompt(req),
    output: Output.object({ schema: QuizSchema }),
    maxOutputTokens: 6000,
  });
  let questions = output.questions.map(normalizeQuestion).filter((q): q is QuestionOutput => !!q).slice(0, req.count);
  let verified = false;

  if (req.verify && questions.length > 0) {
    try {
      const { output: check } = await generateText({
        model,
        prompt: verifyPrompt(questions),
        output: Output.object({ schema: VerifySchema }),
        maxOutputTokens: 4000,
      });
      questions = questions
        .map((q, i) => {
          const r = check.results.find((x) => x.index === i);
          if (!r || r.correct || !r.fixedAnswer.trim()) return q;
          return normalizeQuestion({ ...q, answer: r.fixedAnswer, explanation: r.fixedExplanation || q.explanation });
        })
        .filter((q): q is QuestionOutput => !!q);
      verified = true;
    } catch {
      // 검산이 실패해도 문제는 그대로 준다
    }
  }
  return { title: output.title.trim() || "AI 퀴즈", questions, verified };
}
