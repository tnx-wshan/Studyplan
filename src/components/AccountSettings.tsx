"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, SectionTitle } from "@/components/ui";
import { passwordProblem } from "@/lib/account";

const inputClass = "w-full rounded-2xl border-2 border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-accent";

/** 설정의 '계정': 로그인한 메일주소와 비밀번호 변경 */
export function AccountSettings() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEmail(d?.email ?? null))
      .catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(next) ?? (next !== confirm ? "새 비밀번호 확인이 달라요." : null);
    if (problem) return setMessage({ text: problem, error: true });
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMessage({ text: data.error ?? "비밀번호를 바꾸지 못했어요.", error: true });
      setCurrent("");
      setNext("");
      setConfirm("");
      setOpen(false);
      setMessage({ text: "비밀번호를 바꿨어요. 다른 기기에서는 새 비밀번호로 다시 로그인해야 해요.", error: false });
    } catch {
      setMessage({ text: "서버에 연결하지 못했어요.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionTitle>계정</SectionTitle>
      <Card className="space-y-3">
        <div>
          <p className="text-sm text-ink-soft">로그인 아이디 (메일주소)</p>
          <p className="break-all font-semibold">{email ?? "…"}</p>
        </div>
        {message && (
          <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-danger" : "text-sm text-ink-soft"}>
            {message.text}
          </p>
        )}
        {open ? (
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block space-y-1">
              <span className="text-sm text-ink-soft">현재 비밀번호</span>
              <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-ink-soft">새 비밀번호</span>
              <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
              <span className="block text-xs text-ink-soft">8자 이상, 영문자와 숫자를 모두 넣어 주세요.</span>
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-ink-soft">새 비밀번호 확인</span>
              <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={busy || !current || !next || !confirm}>
                {busy ? "바꾸는 중…" : "비밀번호 바꾸기"}
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="ghost" className="w-full" onClick={() => setOpen(true)}>
            비밀번호 바꾸기
          </Button>
        )}
      </Card>
    </section>
  );
}
