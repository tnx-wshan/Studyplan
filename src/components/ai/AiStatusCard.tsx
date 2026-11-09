"use client";

import type { AiStatus } from "@/lib/ai/client";
import { Card, ProgressBar } from "../ui";

export function AiStatusCard({ status, error }: { status: AiStatus | null; error: string | null }) {
  if (error) return <Card className="text-sm text-danger">AI 상태를 불러오지 못했어요: {error}</Card>;
  if (!status) return <Card className="text-sm text-ink-soft">AI 상태 확인 중…</Card>;
  if (!status.configured) {
    return (
      <Card className="space-y-2 border-xp bg-xp/10">
        <p className="font-display">🔑 AI 키가 필요해요</p>
        <p className="text-sm">{status.problem}</p>
        <p className="text-xs text-ink-soft">
          지금 설정: {status.providerLabel}. 다른 회사를 쓰려면 AI_PROVIDER를 gemini, claude, openai 중 하나로 바꾸고 그 회사의 키를 넣은 뒤 앱을 다시 시작하세요.
        </p>
      </Card>
    );
  }
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-display">🤖 {status.providerLabel}</span>
        <span className="truncate text-xs text-ink-soft">{status.modelId}</span>
      </div>
      <ul className="space-y-2">
        {status.usage.map((u) => (
          <li key={u.feature} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-xs">
            <span className="text-ink-soft">{u.label}</span>
            <ProgressBar value={(u.limit - u.used) / u.limit} className="h-2.5 border-0" color="var(--accent)" label={`${u.label} 남은 횟수`} />
            <span className="tabular-nums">
              {u.limit - u.used}/{u.limit} 남음
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
