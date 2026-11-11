"use client";

import type { CoachRequest, FeedbackRequest, MaterialRequest, QuestionOutput, QuizRequest, TutorRequest } from "./schemas";
import type { AiFeedback, CoachReport } from "@/lib/db/types";

export interface AiStatus {
  provider: string;
  providerLabel: string;
  modelId: string;
  configured: boolean;
  problem?: string;
  usage: { feature: "tutor" | "quiz" | "material" | "coach"; label: string; used: number; limit: number }[];
}

export interface MaterialResponse {
  title: string;
  summary: string;
  keyPoints: string[];
  sources: { title: string; url: string }[];
  notice?: string;
  /** 자료 모음에 저장된 id */
  bankId?: string;
  /** 다른 학생이 이미 만든 것을 가져왔다 (AI 사용 횟수를 쓰지 않음) */
  fromBank?: boolean;
}

export interface QuizResponse {
  title: string;
  questions: QuestionOutput[];
  verified: boolean;
  bankId?: string;
  fromBank?: boolean;
}

async function readError(res: Response): Promise<Error> {
  const data = await res.json().catch(() => null);
  if (res.status === 401) return new Error("잠금이 풀려 있지 않아요. 다시 로그인해 주세요.");
  return new Error(data?.error ?? `요청에 실패했어요 (${res.status}).`);
}

export async function fetchAiStatus(): Promise<AiStatus> {
  const res = await fetch("/api/ai/status", { cache: "no-store" });
  if (!res.ok) throw await readError(res);
  return res.json();
}

const TIMEOUT_MESSAGE = "AI 응답이 너무 오래 걸려서 멈췄어요. 잠시 뒤에 다시 시도해 주세요.";

/**
 * 제한 시간이 있는 요청. 서버가 응답하지 않아도 화면이 끝없이 기다리지 않게 한다.
 * 호출한 쪽에서 취소(signal)하면 AbortError를 그대로 던진다.
 */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<{ res: Response; done: () => void }> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  const done = () => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  };
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return { res, done };
  } catch (e) {
    done();
    if (timedOut) throw new Error(TIMEOUT_MESSAGE);
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
  }
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  // 자료 정리·문제 만들기는 오래 걸릴 수 있어 넉넉하게 (서버는 요청마다 75초 제한 × 모델 전환)
  const { res, done } = await fetchWithTimeout(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, 240_000, signal);
  try {
    if (!res.ok) throw await readError(res);
    return await res.json();
  } finally {
    done();
  }
}

export const requestMaterial = (body: MaterialRequest, signal?: AbortSignal) => postJson<MaterialResponse>("/api/ai/material", body, signal);
export const requestQuiz = (body: QuizRequest, signal?: AbortSignal) => postJson<QuizResponse>("/api/ai/quiz", body, signal);
export const requestFeedback = (body: FeedbackRequest) => postJson<AiFeedback>("/api/ai/feedback", body);
export const requestCoach = (body: CoachRequest) =>
  postJson<Pick<CoachReport, "summary" | "strengths" | "improvements" | "recommendations" | "goals" | "madeBy">>("/api/ai/coach", body);

/** 튜터 답을 조각조각 받으며 onText로 알려준다. 전체 답을 돌려준다. */
export async function streamTutor(body: TutorRequest, onText: (full: string) => void, signal?: AbortSignal): Promise<string> {
  // 첫 글자까지: 서버가 모델을 바꿔 가며 시도하는 시간을 포함해 90초
  const { res, done } = await fetchWithTimeout("/api/ai/tutor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, 90_000, signal);
  done();
  if (!res.ok || !res.body) throw await readError(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    // 답이 나오다가 30초 넘게 멈추면 거기까지만 보여준다
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stalled = new Promise<"stalled">((resolve) => (timer = setTimeout(() => resolve("stalled"), 30_000)));
    const next = await Promise.race([reader.read(), stalled]);
    clearTimeout(timer);
    if (next === "stalled") {
      void reader.cancel();
      full += "\n\n(응답이 중간에 끊겼어요. 다시 질문해 주세요.)";
      onText(full);
      return full;
    }
    if (next.done) break;
    full += decoder.decode(next.value, { stream: true });
    onText(full);
  }
  full += decoder.decode();
  onText(full);
  return full;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
