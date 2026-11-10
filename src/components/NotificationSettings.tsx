"use client";

import { useState } from "react";
import { DEFAULT_PUSH, disablePush, enablePush, pushSupport, readPushState, testPush, updatePushSettings, type LocalPushState } from "@/lib/push/client";
import type { ReminderSettings } from "@/lib/push/schedule";
import { toast } from "./Toaster";
import { useUiStyle } from "./ThemeSync";
import { Button, Card, SectionTitle } from "./ui";

const ROWS: { key: "review" | "plan" | "streak"; label: string; hint: string }[] = [
  { key: "review", label: "복습 알림", hint: "오늘 복습할 카드와 오답 확인" },
  { key: "plan", label: "계획 시작 알림", hint: "오늘 할 일 시작" },
  { key: "streak", label: "연속 기록 지키기", hint: "그날 공부 기록이 없을 때만" },
];

export function NotificationSettings() {
  const style = useUiStyle();
  const [state, setState] = useState<LocalPushState>(() => (typeof window === "undefined" ? DEFAULT_PUSH : readPushState()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const support = typeof window === "undefined" ? "ok" : pushSupport();
  const settings: ReminderSettings = { ...state.settings, style };

  async function run(fn: () => Promise<LocalPushState | void>, ok?: string) {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      if (next) setState(next);
      if (ok) toast(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알림 설정에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionTitle>
        <span className="kicker">Notifications</span>
        알림
      </SectionTitle>
      <Card className="space-y-3">
        {support === "ios-install" && <p className="text-sm text-ink-soft">아이폰은 Safari의 공유 → “홈 화면에 추가”로 설치한 뒤, 설치한 앱에서 알림을 켤 수 있어요.</p>}
        {support === "no-sw" && <p className="text-sm text-ink-soft">이 브라우저는 알림을 지원하지 않아요.</p>}
        {support === "denied" && <p className="text-sm text-danger">알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.</p>}
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                className="size-5 accent-[var(--primary)]"
                checked={settings[r.key] !== null}
                onChange={(e) => {
                  const next = { ...settings, [r.key]: e.target.checked ? DEFAULT_PUSH.settings[r.key] : null };
                  void run(() => updatePushSettings(state, next));
                }}
              />
              <span>
                <span className="block text-sm">{r.label}</span>
                <span className="block text-xs text-ink-soft">{r.hint}</span>
              </span>
            </label>
            <input
              type="time"
              aria-label={`${r.label} 시각`}
              value={settings[r.key] ?? ""}
              disabled={settings[r.key] === null}
              onChange={(e) => e.target.value && void run(() => updatePushSettings(state, { ...settings, [r.key]: e.target.value }))}
              className="rounded-xl border-2 border-line bg-surface px-2 py-1 text-sm disabled:opacity-40"
            />
          </div>
        ))}
        {state.enabled ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => testPush(state), "테스트 알림을 보냈어요")}>
              테스트 알림
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => disablePush(state), "알림을 껐어요")}>
              알림 끄기
            </Button>
          </div>
        ) : (
          <Button className="w-full" disabled={busy || support !== "ok"} onClick={() => run(() => enablePush(settings), "알림을 켰어요")}>
            🔔 알림 켜기
          </Button>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <p className="text-xs text-ink-soft">알림은 홈스터디 서버가 켜져 있을 때 보내져요. 시각은 한국 시간 기준이에요.</p>
      </Card>
    </section>
  );
}
