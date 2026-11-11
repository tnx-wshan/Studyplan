import type { BlankStep, PuzzleStep, QuestionStep, Step } from "./types";

/**
 * 학습 탭 채점과 문제 모양 정리. 화면과 서버(관리 도구의 검사)가 함께 쓴다.
 */

const SUPERSCRIPT: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "ⁿ": "n" };

/**
 * 답 비교용으로 글자를 고른다: 띄어쓰기, 대소문자, 수식 기호의 여러 표기(×·*, ÷·/, x²·x^2, √·sqrt)를 같은 것으로 본다.
 */
export function normalizeAnswer(raw: string): string {
  let s = raw.trim();
  // 수식 표시 기호 $...$ 를 벗긴다
  s = s.replace(/^\$+|\$+$/g, "");
  // 윗첨자는 NFKC가 그냥 숫자로 바꿔 버리므로 먼저 ^로 바꾼다 (x² → x^2, x¹⁰ → x^10)
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻ⁿ]+/g, (m) => `^${[...m].map((c) => SUPERSCRIPT[c]).join("")}`);
  s = s.normalize("NFKC").toLowerCase();
  s = s
    .replace(/[×·∙]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/√/g, "sqrt")
    .replace(/π/g, "pi")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/≠/g, "!=")
    .replace(/\\sqrt/g, "sqrt")
    .replace(/\\pi/g, "pi")
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\le(q)?(?![a-z])/g, "<=")
    .replace(/\\ge(q)?(?![a-z])/g, ">=")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
  // 띄어쓰기와 문장 끝 기호, 따옴표는 채점에서 뺀다
  s = s.replace(/\s+/g, "").replace(/[.。!?]+$/g, "").replace(/['"“”‘’「」『』]/g, "");
  // sqrt(2) 와 sqrt2, {2} 와 2 를 같게
  s = s.replace(/sqrt\{([^{}]+)\}/g, "sqrt($1)").replace(/sqrt([0-9a-z])(?![0-9a-z(])/g, "sqrt($1)");
  // 숫자 하나만 괄호에 싸인 분수 (3)/(4) → 3/4
  s = s.replace(/\((-?[0-9.]+)\)\/\((-?[0-9.]+)\)/g, "$1/$2");
  return s;
}

/** "3", "-0.5", "3/4", "-3/4" 같은 단순한 수라면 값을 돌려준다 */
export function numericValue(normalized: string): number | null {
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);
  const m = normalized.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (m && Number(m[2]) !== 0) return Number(m[1]) / Number(m[2]);
  return null;
}

/** 정답 목록 중 하나와 같으면 맞음. 단순한 수는 값으로 비교한다 (0.5 = 1/2) */
export function matchesAnswer(input: string, answers: string[]): boolean {
  const a = normalizeAnswer(input);
  if (!a) return false;
  const av = numericValue(a);
  return answers.some((ans) => {
    const b = normalizeAnswer(ans);
    if (!b) return false;
    if (a === b) return true;
    const bv = numericValue(b);
    return av !== null && bv !== null && Math.abs(av - bv) < 1e-9;
  });
}

// ───────── 빈칸 ─────────

export type BlankPart = { kind: "text"; text: string } | { kind: "blank"; index: number; answer: string };

/** "광합성은 [[엽록체]]에서 일어난다" → 글자 조각과 빈칸 */
export function parseBlanks(text: string): BlankPart[] {
  const parts: BlankPart[] = [];
  const re = /\[\[([^\]]+?)\]\]/g;
  let last = 0;
  let index = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ kind: "text", text: text.slice(last, m.index) });
    parts.push({ kind: "blank", index: index++, answer: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

export function blankAnswers(step: Pick<BlankStep, "text">): string[] {
  return parseBlanks(step.text).flatMap((p) => (p.kind === "blank" ? [p.answer] : []));
}

// ───────── 낱말 퍼즐 ─────────

/** 글자 단위로 나눈다 (한글 음절, 영문 글자). 띄어쓰기는 뺀다 */
export function letters(word: string): string[] {
  return Array.from(word.normalize("NFC").replace(/\s+/g, ""));
}

/** 퍼즐 조각: 정답 글자 + 헷갈리는 글자를 섞는다. random을 바꿔 끼울 수 있게 해서 시험할 수 있다 */
export function puzzleTiles(step: Pick<PuzzleStep, "answer" | "decoys">, random = Math.random): string[] {
  const tiles = [...letters(step.answer), ...letters(step.decoys).slice(0, 6)];
  return shuffle(tiles, random);
}

export function shuffle<T>(list: T[], random = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ───────── 채점 ─────────

/** 학생의 답: 객관식·주관식·퍼즐은 글자 하나, 빈칸은 빈칸 순서대로 */
export type StepAnswer = string | string[];

export function gradeStep(step: QuestionStep, answer: StepAnswer): boolean {
  switch (step.type) {
    case "choice":
      return typeof answer === "string" && answer === step.answer;
    case "short":
      return typeof answer === "string" && matchesAnswer(answer, step.answers);
    case "puzzle":
      return typeof answer === "string" && normalizeAnswer(answer) === normalizeAnswer(step.answer);
    case "blank": {
      const expected = blankAnswers(step);
      const given = Array.isArray(answer) ? answer : [answer];
      return expected.length > 0 && expected.every((e, i) => given[i] !== undefined && normalizeAnswer(given[i]) === normalizeAnswer(e));
    }
  }
}

/** 오답일 때 보여줄 정답 */
export function correctAnswerText(step: QuestionStep): string {
  switch (step.type) {
    case "choice":
      return step.answer;
    case "short":
      return step.answers[0] ?? "";
    case "puzzle":
      return step.answer;
    case "blank":
      return blankAnswers(step).join(", ");
  }
}

// ───────── 문제 모양 검사 (관리 도구 저장·AI 결과 정리) ─────────

const clean = (s: unknown) => (typeof s === "string" ? s.trim() : "");
const cleanList = (xs: unknown) => (Array.isArray(xs) ? xs.map(clean).filter(Boolean) : []);

/**
 * 잘못된 단계는 고치거나 버린다. 문제가 왜 버려졌는지 알 수 있게 이유도 돌려준다.
 * (객관식 정답이 보기에 없음, 빈칸이 없음, 퍼즐 낱말이 너무 김 등)
 */
export function sanitizeStep(raw: unknown): { step: Step | null; problem?: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const type = r.type;
  const prompt = clean(r.prompt);
  const explanation = clean(r.explanation);
  switch (type) {
    case "summary": {
      const body = clean(r.body);
      if (!body) return { step: null, problem: "핵심 정리 내용이 비어 있어요." };
      return { step: { type, title: clean(r.title) || "핵심 정리", body, points: cleanList(r.points).slice(0, 7) } };
    }
    case "choice": {
      const choices = [...new Set(cleanList(r.choices))];
      const answer = clean(r.answer);
      if (!prompt) return { step: null, problem: "문제가 비어 있어요." };
      if (choices.length < 2) return { step: null, problem: "보기가 2개 이상 있어야 해요." };
      if (!choices.includes(answer)) return { step: null, problem: `정답 "${answer}"이(가) 보기에 없어요.` };
      return { step: { type, prompt, choices: choices.slice(0, 5), answer, explanation } };
    }
    case "short": {
      const answers = cleanList(r.answers ?? (r.answer ? [r.answer] : []));
      if (!prompt || answers.length === 0) return { step: null, problem: "문제와 정답이 있어야 해요." };
      return { step: { type, prompt, answers, explanation, ...(r.math ? { math: true } : {}) } };
    }
    case "blank": {
      const text = clean(r.text);
      if (blankAnswers({ text }).length === 0) return { step: null, problem: "빈칸이 없어요. 빈칸으로 만들 낱말을 [[ ]]로 감싸 주세요." };
      const answers = new Set(blankAnswers({ text }).map(normalizeAnswer));
      const distractors = cleanList(r.distractors).filter((d) => !answers.has(normalizeAnswer(d))).slice(0, 4);
      return { step: { type, prompt: prompt || "빈칸에 알맞은 말을 고르세요.", text, distractors, explanation } };
    }
    case "puzzle": {
      const answer = clean(r.answer);
      const n = letters(answer).length;
      if (!prompt) return { step: null, problem: "뜻풀이가 비어 있어요." };
      if (n < 2 || n > 10) return { step: null, problem: "퍼즐 낱말은 2~10글자여야 해요." };
      return { step: { type, prompt, answer, decoys: clean(r.decoys).slice(0, 6), explanation } };
    }
    default:
      return { step: null, problem: "알 수 없는 단계 종류예요." };
  }
}

export function sanitizeSteps(raw: unknown): { steps: Step[]; problems: string[] } {
  const steps: Step[] = [];
  const problems: string[] = [];
  (Array.isArray(raw) ? raw : []).forEach((r, i) => {
    const { step, problem } = sanitizeStep(r);
    if (step) steps.push(step);
    else problems.push(`${i + 1}번째 단계: ${problem}`);
  });
  return { steps, problems };
}

/** 단계 수로 예상 시간(분)을 어림한다: 정리 40초, 문제 15초 */
export function estimateMinutes(steps: Step[]): number {
  const sec = steps.reduce((s, x) => s + (x.type === "summary" ? 40 : 15), 0);
  return Math.max(1, Math.round(sec / 60));
}

export function questionCount(steps: Step[]): number {
  return steps.filter((s) => s.type !== "summary").length;
}

