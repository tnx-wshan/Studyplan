import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel, ToolSet } from "ai";
import { mockModel } from "./mock";

export type ProviderId = "gemini" | "claude" | "openai" | "mock";

/** 기본 모델. AI_MODEL로 바꿀 수 있다. */
const DEFAULT_MODELS: Record<ProviderId, string> = {
  gemini: "gemini-flash-latest",
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

/** 설정된 회사의 모델과 그 회사의 웹 검색 도구 */
export function getModel(): { model: LanguageModel; webSearch: () => ToolSet; setup: AiSetup } {
  const setup = aiSetup();
  if (!setup.configured) throw new AiNotConfiguredError(setup.problem);
  switch (setup.provider) {
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey: readKey("gemini") });
      return { model: google(setup.modelId), webSearch: () => ({ google_search: google.tools.googleSearch({}) }), setup };
    }
    case "claude": {
      const anthropic = createAnthropic({ apiKey: readKey("claude") });
      return {
        model: anthropic(setup.modelId),
        webSearch: () => ({ web_search: anthropic.tools.webSearch_20260318({ maxUses: 3 }) }),
        setup,
      };
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: readKey("openai") });
      return { model: openai(setup.modelId), webSearch: () => ({ web_search: openai.tools.webSearch({}) }), setup };
    }
    case "mock":
      return { model: mockModel(), webSearch: () => ({}), setup };
  }
}
