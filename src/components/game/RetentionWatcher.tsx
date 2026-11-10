"use client";

import { useEffect } from "react";
import { toast } from "../Toaster";
import { useUiStyle } from "../ThemeSync";
import { applyStreakFreeze, detectComeback } from "@/lib/db/retention";

/**
 * 앱을 열 때(그리고 날짜가 바뀔 때) 한 번:
 * - 빠진 날을 보호권으로 메울 수 있으면 자동으로 쓴다
 * - 오래 쉬었다 돌아왔으면 복귀 환영을 켠다
 */
export function RetentionWatcher({ today }: { today: string }) {
  const noir = useUiStyle() === "noir";
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const used = await applyStreakFreeze(today);
      if (!cancelled && used.length) toast(noir ? `보호권 ${used.length}개 소모 — 기록은 끊기지 않았다` : `🛡️ 보호권 ${used.length}개를 써서 연속 기록을 지켰어요`);
      await detectComeback(today);
    })();
    return () => {
      cancelled = true;
    };
    // 테마가 바뀔 때 다시 실행할 필요는 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);
  return null;
}
