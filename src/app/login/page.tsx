"use client";

import { useState, type FormEvent } from "react";
import { Pet } from "@/components/Pet";
import { Button, Card } from "@/components/ui";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "로그인하지 못했어요.");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      // 같은 사이트 안의 경로로만 이동
      window.location.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch {
      setError("서버에 연결하지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4">
      <Pet species="cloud" stage="egg" mood="happy" size={120} />
      <h1 className="font-display text-3xl logo">홈스터디</h1>
      <Card className="w-full">
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm text-ink-soft">비밀번호</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border-2 border-line bg-surface px-4 py-3 text-lg outline-none focus:border-accent"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? "확인 중…" : "들어가기"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
