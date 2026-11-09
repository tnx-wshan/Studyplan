"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { initialTimer, type TimerState } from "@/lib/study/timer";

const KEY = "hs-timer";
const listeners = new Set<() => void>();
let cache: TimerState | null = null;
let cacheRaw: string | null = null;

function read(): TimerState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw === cacheRaw && cache) return cache;
  cacheRaw = raw;
  try {
    cache = raw ? { ...initialTimer(), ...JSON.parse(raw) } : initialTimer();
  } catch {
    cache = initialTimer();
  }
  return cache!;
}

export function getTimer(): TimerState {
  return read();
}

export function setTimer(state: TimerState) {
  const raw = JSON.stringify(state);
  try {
    localStorage.setItem(KEY, raw);
  } catch {}
  cacheRaw = raw;
  cache = state;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const SERVER = initialTimer();

export function useTimerState(): TimerState {
  return useSyncExternalStore(subscribe, read, () => SERVER);
}

/** 1분마다 바뀌는 숫자. 시간이 지나면서 바뀌는 조회(복습할 카드 등)를 다시 실행하는 데 쓴다. */
export function useMinuteTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

/** 1초마다 갱신되는 현재 시각 */
export function useNow(active = true, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
