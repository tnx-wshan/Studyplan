"use client";

import { useEffect } from "react";
import { requestSync } from "@/lib/syncStore";

const EVERY_MS = 5 * 60_000;

/** 앱을 여는 동안 관리 도구와 주기적으로 동기화한다 (화면을 다시 볼 때도) */
export function SyncWatcher() {
  useEffect(() => {
    void requestSync();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void requestSync();
    }, EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void requestSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
