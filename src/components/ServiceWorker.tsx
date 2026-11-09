"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    // 기기 저장 공간이 부족해도 데이터가 지워지지 않도록 요청
    navigator.storage?.persist?.().catch(() => {});
  }, []);
  return null;
}
