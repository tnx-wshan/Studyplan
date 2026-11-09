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

// ───────── 3단계 코칭 ─────────

export const FeedbackSchema = z.object({
  score: z.number().describe("이해도 0~100"),
  good: z.array(z.string()).describe("잘 설명한 점 1~3개"),
  missing: z.array(z.string()).describe("빠진 핵심 개념 0~4개"),
  misconceptions: z.array(z.string()).describe("틀리거나 헷갈린 설명 0~3개. 없으면 빈 배열"),
  nextStep: z.string().describe("다음에 할 일 한 문장"),
});

export const FeedbackRequestSchema = z.object({
  kind: z.enum(["blank", "feynman"]),
  grade: z.string().max(20),
  subject: z.string().max(20).optional(),
  topic: z.string().min(1).max(100),
  text: z.string().min(1).max(6000),
  /** 비교할 정리 자료가 있으면 */
  reference: z.string().max(12_000).optional(),
});
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;

export const CoachSchema = z.object({
  summary: z.string().describe("이번 기간 공부를 2~3문장으로 따뜻하게 정리"),
  strengths: z.array(z.string()).describe("잘한 점 2~3개 (구체적인 숫자 근거)"),
  improvements: z.array(z.string()).describe("보완할 점 1~3개 (구체적으로)"),
  recommendations: z
    .array(z.object({ methodId: z.string().describe("학습법 목록의 id 중 하나"), reason: z.string().describe("이 학생에게 권하는 이유 한 문장") }))
    .describe("학습법 추천 1~3개"),
  goals: z.array(z.string()).describe("다음 기간 실천 목표 2~3개 (측정 가능하게)"),
});

export const CoachRequestSchema = z.object({
  grade: z.string().max(20),
  periodLabel: z.string().max(40),
  /** 통계 요약 (앱이 만든 글) */
  stats: z.string().min(1).max(6000),
  reflection: z.string().max(2000).optional(),
  weakAreas: z.array(z.string().max(30)).max(6),
  methods: z.array(z.object({ id: z.string().max(30), name: z.string().max(40) })).max(30),
});
export type CoachRequest = z.infer<typeof CoachRequestSchema>;
