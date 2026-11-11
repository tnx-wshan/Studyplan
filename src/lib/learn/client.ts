"use client";

import type { CourseInfo, CourseOutline, LearnSection, LearnUnit } from "./types";

/**
 * 학습 탭 내용은 서버에 있다. 한 번 받은 것은 기기에 저장해 두어 인터넷이 없을 때도 이어서 할 수 있게 한다.
 */
const PREFIX = "hs-learn:";

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function cacheSet(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 저장 공간이 부족하면 캐시 없이
  }
}

export class LearnFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function getJson<T>(url: string, key: string): Promise<{ data: T; offline: boolean }> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new LearnFetchError(body?.error ?? `불러오지 못했어요 (${res.status}).`, res.status);
    }
    const data = (await res.json()) as T;
    cacheSet(key, data);
    return { data, offline: false };
  } catch (e) {
    // 서버가 '없음'이라고 답한 것은 캐시로 덮지 않는다
    if (e instanceof LearnFetchError && e.status !== 401 && e.status < 500) throw e;
    const cached = cacheGet<T>(key);
    if (cached) return { data: cached, offline: true };
    throw e instanceof LearnFetchError ? e : new LearnFetchError("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.", 0);
  }
}

export const fetchCourses = () => getJson<{ courses: CourseInfo[] }>("/api/learn/courses", "courses");

export const fetchOutline = (grade: string, subject: string) =>
  getJson<CourseOutline>(`/api/learn/outline?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}`, `outline:${grade}:${subject}`);

export const fetchUnit = (id: string) => getJson<LearnUnit & { section: LearnSection }>(`/api/learn/unit?id=${encodeURIComponent(id)}`, `unit:${id}`);
