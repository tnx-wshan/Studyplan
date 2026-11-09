"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAiStatus, type AiStatus } from "@/lib/ai/client";

export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    fetchAiStatus()
      .then((s) => {
        setStatus(s);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const remaining = (feature: "tutor" | "quiz" | "material") => {
    const u = status?.usage.find((x) => x.feature === feature);
    return u ? u.limit - u.used : null;
  };
  return { status, error, refresh, remaining };
}
