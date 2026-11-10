import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel, ToolSet } from "ai";
import { mockModel } from "./mock";

export type ProviderId = "gemini" | "claude" | "openai" | "mock";

/** 기본 모델. AI_MODEL로 바꿀 수 있다. */
const DEFAULT_MODELS: Record<ProviderId, string> = {
  // 무료 등급 키에서도 한도가 넉넉하고 응답이 빠른 모델
  gemini: "gemini-3.5-flash",
  claude: "claude-sonnet-5-5",
  openai: "gpt-5.5",
  mock: "mock",
};

const KEY_ENV: Record<Exclude<ProviderId, "mock">, string[]> = {
  gemini: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
  claude: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
  openai: "OpenAI ChatGPT",
  mock: "테스트용 가짜 AI",
};

function readKey(provider: Exclude<ProviderId, "mock">): string | undefined {
  for (const name of KEY_ENV[provider]) if (process.env[name]) return process.env[name];
  return undefined;
}

export interface AiSetup {
  provider: ProviderId;
  modelId: string;
  configured: boolean;
  /** 설정이 안 됐을 때 이유 */
  problem?: string;
}

export function aiSetup(): AiSetup {
  const raw = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const provider = (["gemini", "claude", "openai", "mock"].includes(raw) ? raw : "gemini") as ProviderId;
  const modelId = process.env.AI_MODEL || DEFAULT_MODELS[provider];
  if (provider === "mock") return { provider, modelId, configured: true };
  return readKey(provider)
    ? { provider, modelId, configured: true }
    : { provider, modelId, configured: false, problem: `.env.local에 ${KEY_ENV[provider][0]}를 넣어주세요.` };
}

export class AiNotConfiguredError extends Error {}

/**
 * 먼저 쓸 모델이 붐비거나 없어졌을 때 대신 쓸 모델들.
 * AI_MODEL_FALLBACKS(쉼표로 구분)로 바꿀 수 있고, 빈 값이면 대신 쓸 모델 없이 동작한다.
 */
const DEFAULT_FALLBACKS: Record<ProviderId, string[]> = {
  gemini: ["gemini-flash-lite-latest", "gemini-flash-latest"],
  claude: [],
  openai: [],
  mock: [],
};

function modelIds(setup: AiSetup): string[] {
  const env = process.env.AI_MODEL_FALLBACKS;
  const fallbacks = env !== undefined ? env.split(",").map((x) => x.trim()).filter(Boolean) : DEFAULT_FALLBACKS[setup.provider];
  return [...new Set([setup.modelId, ...fallbacks])];
}

/** 설정된 회사의 모델과 그 회사의 웹 검색 도구 */
export interface AiHandle {
  /** 먼저 쓸 모델 */
  model: LanguageModel;
  /** 먼저 쓸 모델과 대신 쓸 모델들 (순서대로 시도) */
  models: LanguageModel[];
  webSearch: () => ToolSet;
  /** 빠른 답이 중요한 대화(튜터)용 설정: 생각 시간을 줄인다 */
  fastOptions?: { google: { thinkingConfig: { thinkingLevel: "low" } } };
  setup: AiSetup;
}

export function getModel(): AiHandle {
  const setup = aiSetup();
  if (!setup.configured) throw new AiNotConfiguredError(setup.problem);
  switch (setup.provider) {
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey: readKey("gemini") });
      const models = modelIds(setup).map((id) => google(id));
      return {
        model: models[0],
        models,
        webSearch: () => ({ google_search: google.tools.googleSearch({}) }),
        fastOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
        setup,
      };
    }
    case "claude": {
      const anthropic = createAnthropic({ apiKey: readKey("claude") });
      return {
        model: anthropic(setup.modelId),
        models: modelIds(setup).map((id) => anthropic(id)),
        webSearch: () => ({ web_search: anthropic.tools.webSearch_20260318({ maxUses: 3 }) }),
        setup,
      };
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: readKey("openai") });
      return { model: openai(setup.modelId), models: modelIds(setup).map((id) => openai(id)), webSearch: () => ({ web_search: openai.tools.webSearch({}) }), setup };
    }
    case "mock":
      return { model: mockModel(), models: [mockModel()], webSearch: () => ({}), setup };
  }
}
