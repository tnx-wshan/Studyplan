"use client";

/** 관리 도구 화면에서 관리 API를 부른다. 로그인이 풀렸으면 로그인 화면으로 보낸다 */
export async function adminApi<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("서버에 연결하지 못했어요.");
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.replace("/admin/login");
    throw new Error("관리자 로그인이 필요해요.");
  }
  if (!res.ok) throw new Error(data?.error ?? `요청에 실패했어요 (${res.status}).`);
  return data as T;
}

export function formatTime(ts: number | null | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ago(ts: number | null | undefined): string {
  if (!ts) return "-";
  const min = Math.round((Date.now() - ts) / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}
