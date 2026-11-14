"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Pet } from "@/components/Pet";
import { Button, Card, cn } from "@/components/ui";
import { isValidEmail, normalizeEmail, passwordProblem } from "@/lib/account";
import { signInDevice } from "@/lib/db/account";

type Mode = "login" | "signup";

const inputClass = "w-full rounded-2xl border-2 border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const signup = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setConfirm("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const mail = normalizeEmail(email);
    if (signup) {
      const problem = !isValidEmail(mail) ? "메일주소 형식이 올바르지 않아요." : passwordProblem(password) ?? (password !== confirm ? "비밀번호 확인이 달라요." : null);
      if (problem) return setError(problem);
    }
    setLoading(true);
    try {
      const res = await fetch(signup ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: mail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "로그인하지 못했어요.");
        return;
      }
      // 이 기기는 이제 이 계정으로 쓴다 (기기 데이터를 이 계정에 연결)
      signInDevice(String(data.accountId));
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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 py-8">
      <Pet species="cloud" stage="egg" mood="happy" size={120} />
      <h1 className="font-display text-3xl logo">홈스터디</h1>
      <Card className="w-full space-y-3">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="로그인 또는 회원가입">
          {(
            [
              ["login", "로그인"],
              ["signup", "회원가입"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => switchMode(id)}
              className={cn(
                "rounded-2xl border-2 px-3 py-2 text-sm font-semibold",
                mode === id ? "border-accent bg-accent/10 text-ink" : "border-line text-ink-soft",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <label className="block space-y-1.5">
            <span className="text-sm text-ink-soft">메일주소 (아이디)</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-ink-soft">비밀번호</span>
            <input
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          {signup && <p className="-mt-1 text-xs text-ink-soft">8자 이상, 영문자와 숫자를 모두 넣어 주세요.</p>}
          {signup && (
            <label className="block space-y-1.5">
              <span className="text-sm text-ink-soft">비밀번호 확인</span>
              <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading || !email || !password}>
            {loading ? "확인 중…" : signup ? "가입하고 시작하기" : "들어가기"}
          </Button>
        </form>
        <p className="text-xs text-ink-soft">
          {signup
            ? "메일 인증은 하지 않아요. 메일주소는 로그인 아이디로만 쓰이니, 쓰는 주소를 정확히 적어 주세요. 한 번 로그인하면 이 기기에서는 계속 로그인된 상태로 쓸 수 있어요."
            : "비밀번호를 잊었다면 관리자에게 임시 비밀번호를 받아 주세요."}
        </p>
      </Card>
      <Link href="/intro" className="text-sm text-ink-soft underline">
        홈스터디는 어떤 앱인가요?
      </Link>
    </main>
  );
}
