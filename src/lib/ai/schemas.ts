import { z } from "zod";

export const MaterialSchema = z.object({
  title: z.string().describe("자료 제목 (20자 이내)"),
  summary: z.string().describe("학생용 개념 정리. 마크다운, 수식은 $...$ (KaTeX)"),
  keyPoints: z.array(z.string()).describe("꼭 기억할 핵심 3~7개"),
});
export type MaterialOutput = z.infer<typeof MaterialSchema>;

export const QuestionSchema = z.object({
  type: z.enum(["multiple", "short", "essay"]),
  prompt: z.string().describe("문제. 마크다운, 수식은 $...$"),
  choices: z.array(z.string()).describe("객관식 보기 4~5개. 객관식이 아니면 빈 배열"),
  answer: z.string().describe("정답. 객관식은 정답 보기의 내용을 그대로"),
  explanation: z.string().describe("풀이와 해설"),
  concept: z.string().describe("이 문제가 확인하는 핵심 개념 한 줄"),
});
export type QuestionOutput = z.infer<typeof QuestionSchema>;

export const QuizSchema = z.object({
  title: z.string().describe("퀴즈 제목 (20자 이내)"),
  questions: z.array(QuestionSchema),
});
export type QuizOutput = z.infer<typeof QuizSchema>;

export const VerifySchema = z.object({
  results: z.array(
    z.object({
      index: z.number().describe("문제 번호 (0부터)"),
      correct: z.boolean().describe("주어진 정답이 맞는지"),
      fixedAnswer: z.string().describe("틀렸다면 올바른 정답, 맞으면 빈 문자열"),
      fixedExplanation: z.string().describe("틀렸다면 고친 해설, 맞으면 빈 문자열"),
    }),
  ),
});
export type VerifyOutput = z.infer<typeof VerifySchema>;

const DATA_URL = /^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,[A-Za-z0-9+/=]+$/;

/** 튜터 요청 본문 */
export const TutorRequestSchema = z.object({
  mode: z.enum(["hint", "solution"]),
  grade: z.string().max(20),
  subject: z.string().max(20).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
        images: z.array(z.string().max(8_000_000).regex(DATA_URL)).max(4).optional(),
      }),
    )
    .min(1)
    .max(40),
});
export type TutorRequest = z.infer<typeof TutorRequestSchema>;

/** 자료 만들기 요청 본문 */
export const MaterialRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("photo"), grade: z.string().max(20), subject: z.string().max(20).optional(), images: z.array(z.string().max(8_000_000).regex(DATA_URL)).min(1).max(5) }),
  z.object({ kind: z.literal("pdf"), grade: z.string().max(20), subject: z.string().max(20).optional(), pdf: z.string().max(20_000_000).regex(DATA_URL) }),
  z.object({ kind: z.literal("web"), grade: z.string().max(20), subject: z.string().max(20).optional(), query: z.string().min(1).max(200) }),
  z.object({ kind: z.literal("curriculum"), grade: z.string().max(20), course: z.string().min(1).max(40), unit: z.string().min(1).max(80) }),
]);
export type MaterialRequest = z.infer<typeof MaterialRequestSchema>;

/** 문제 만들기 요청 본문 */
export const QuizRequestSchema = z.object({
  grade: z.string().max(20),
  subject: z.string().max(20).optional(),
  material: z.string().min(1).max(30_000),
  count: z.number().int().min(1).max(15),
  types: z.array(z.enum(["multiple", "short", "essay"])).min(1),
  difficulty: z.enum(["easy", "normal", "hard"]),
  /** 수학·과학처럼 계산이 있는 과목은 정답을 한 번 더 검산 */
  verify: z.boolean(),
});
export type QuizRequest = z.infer<typeof QuizRequestSchema>;
