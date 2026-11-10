"use client";

import type { ReminderSettings } from "./schedule";

const SETTINGS_KEY = "hs-push";

export interface LocalPushState {
  enabled: boolean;
  endpoint?: string;
  settings: ReminderSettings;
}

export const DEFAULT_PUSH: LocalPushState = { enabled: false, settings: { review: "19:00", plan: "16:00", streak: "21:00", style: "noir" } };

export function readPushState(): LocalPushState {
  try {
    return { ...DEFAULT_PUSH, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_PUSH;
  }
}

function writePushState(s: LocalPushState) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

export function pushSupport(): "ok" | "no-sw" | "ios-install" | "denied" {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    const ios = typeof navigator !== "undefined" && /iphone|ipad/i.test(navigator.userAgent);
    return ios ? "ios-install" : "no-sw";
  }
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function post(body: unknown) {
  const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "서버에 저장하지 못했어요.");
}

/** 알림 켜기: 권한 → 서비스 워커 → 구독 → 서버에 저장 */
export async function enablePush(settings: ReminderSettings): Promise<LocalPushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림 권한이 허용되지 않았어요. 브라우저 설정에서 허용해 주세요.");
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const { publicKey } = await (await fetch("/api/push", { cache: "no-store" })).json();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await post({ action: "subscribe", subscription: { endpoint: json.endpoint, keys: json.keys }, settings });
  const state = { enabled: true, endpoint: json.endpoint, settings };
  writePushState(state);
  return state;
}

export async function updatePushSettings(state: LocalPushState, settings: ReminderSettings): Promise<LocalPushState> {
  if (state.enabled) return enablePush(settings);
  const next = { ...state, settings };
  writePushState(next);
  return next;
}

export async function disablePush(state: LocalPushState): Promise<LocalPushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe().catch(() => undefined);
  if (state.endpoint) await post({ action: "unsubscribe", endpoint: state.endpoint }).catch(() => undefined);
  const next = { ...state, enabled: false, endpoint: undefined };
  writePushState(next);
  return next;
}

export async function testPush(state: LocalPushState) {
  if (!state.endpoint) throw new Error("알림이 켜져 있지 않아요.");
  await post({ action: "test", endpoint: state.endpoint });
}

/** 오늘 공부했음을 서버에 알린다 (하루 한 번) */
export async function reportStudied(date: string) {
  const state = readPushState();
  if (!state.enabled) return;
  try {
    if (localStorage.getItem("hs-push-studied") === date) return;
    await post({ action: "studied", date });
    localStorage.setItem("hs-push-studied", date);
  } catch {}
}

/** 루틴이 바뀌면 알림 서버에도 알려 준다 (알림이 켜져 있을 때만) */
export async function syncRoutineReminders(routines: NonNullable<ReminderSettings["routines"]>) {
  const state = readPushState();
  const settings = { ...state.settings, routines };
  if (!state.enabled) {
    writePushState({ ...state, settings });
    return;
  }
  try {
    await enablePush(settings);
  } catch {
    writePushState({ ...state, settings });
  }
}
