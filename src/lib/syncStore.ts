"use client";

import { useSyncExternalStore } from "react";
import { syncNow } from "@/lib/db/sync";
import type { UserStatus } from "@/lib/sync/types";

/** 동기화 결과 중 화면이 알아야 하는 것: 이용 정지 여부 */
const KEY = "hs-user-status";
let status: UserStatus = "active";
try {
  if (typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "suspended") status = "suspended";
} catch {}
const listeners = new Set<() => void>();

function setStatus(next: UserStatus) {
  if (next === status) return;
  status = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {}
  listeners.forEach((l) => l());
}

export function useUserStatus(): UserStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => "active",
  );
}

let running: Promise<void> | null = null;

/** 지금 동기화한다 (이미 하는 중이면 그것을 기다린다) */
export function requestSync(): Promise<void> {
  if (!running) {
    running = syncNow()
      .then((res) => {
        if (res) setStatus(res.status);
      })
      .finally(() => {
        running = null;
      });
  }
  return running;
}
