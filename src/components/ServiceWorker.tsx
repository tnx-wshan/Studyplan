"use client";

import { useEffect } from "react";

/** 오프라인에서도 열 수 있게 미리 저장해 둘 화면 */
const OFFLINE_ROUTES = [
  "/",
  "/planner",
  "/planner/exam",
  "/planner/exam/new",
  "/planner/routines",
  "/timer",
  "/review",
  "/review/cards",
  "/review/cards/deck",
  "/review/cards/study",
  "/review/wrong",
  "/review/wrong/new",
  "/review/wrong/retry",
  "/review/map",
  "/methods",
  "/methods/detail",
  "/methods/practice",
  "/methods/diagnosis",
  "/growth",
  "/growth/report",
  "/growth/badges",
  "/growth/exams",
  "/companion",
  "/companion/records",
  "/settings",
  "/settings/subjects",
  "/ai",
  "/ai/quiz",
  "/ai/library",
  "/profile",
  "/learn/lesson",
];
const WARM_KEY = "hs-sw-warm";

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // 관리 도구(다른 포트)는 오프라인 앱이 아니다
    if (location.pathname.startsWith("/admin")) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    // 기기 저장 공간이 부족해도 데이터가 지워지지 않도록 요청
    navigator.storage?.persist?.().catch(() => {});
  }, []);
  return null;
}

/** 로그인한 화면에서 하루 한 번, 주요 화면을 오프라인용으로 저장해 달라고 서비스 워커에 요청한다 */
export function OfflineWarmup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !navigator.onLine) return;
    const today = new Date().toDateString();
    try {
      if (localStorage.getItem(WARM_KEY) === today) return;
    } catch {}
    let cancelled = false;
    navigator.serviceWorker.ready.then((reg) => {
      if (cancelled || !reg.active) return;
      reg.active.postMessage({ type: "warm", routes: OFFLINE_ROUTES });
      try {
        localStorage.setItem(WARM_KEY, today);
      } catch {}
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
