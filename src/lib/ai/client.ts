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
}

export interface QuizResponse {
  title: string;
  questions: QuestionOutput[];
  verified: boolean;
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

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
  }
  if (!res.ok) throw await readError(res);
  return res.json();
}

export const requestMaterial = (body: MaterialRequest, signal?: AbortSignal) => postJson<MaterialResponse>("/api/ai/material", body, signal);
export const requestQuiz = (body: QuizRequest, signal?: AbortSignal) => postJson<QuizResponse>("/api/ai/quiz", body, signal);
export const requestFeedback = (body: FeedbackRequest) => postJson<AiFeedback>("/api/ai/feedback", body);
export const requestCoach = (body: CoachRequest) =>
  postJson<Pick<CoachReport, "summary" | "strengths" | "improvements" | "recommendations" | "goals" | "madeBy">>("/api/ai/coach", body);

/** 튜터 답을 조각조각 받으며 onText로 알려준다. 전체 답을 돌려준다. */
export async function streamTutor(body: TutorRequest, onText: (full: string) => void, signal?: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/ai/tutor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
  }
  if (!res.ok || !res.body) throw await readError(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
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
