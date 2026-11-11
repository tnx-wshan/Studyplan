"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

/**
 * 브라우저 기본 확인 창(confirm/prompt) 대신 쓰는 앱 디자인의 창.
 *   if (!(await askConfirm("지울까요?", { danger: true }))) return;
 *   const name = await askText("이름", { value: old });   // 취소하면 null
 * 화면에는 <DialogHost />가 하나 있어야 한다 (AppShell).
 */
type Req =
  | { kind: "confirm"; message: string; confirmLabel: string; danger: boolean; resolve: (v: boolean) => void }
  | { kind: "text"; message: string; value: string; confirmLabel: string; resolve: (v: string | null) => void };

type Listener = (r: Req) => void;
let listener: Listener | null = null;

export function askConfirm(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) return resolve(typeof window !== "undefined" ? window.confirm(message) : false);
    listener({ kind: "confirm", message, confirmLabel: opts.confirmLabel ?? "확인", danger: opts.danger ?? false, resolve });
  });
}

export function askText(message: string, opts: { value?: string; confirmLabel?: string } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    if (!listener) return resolve(typeof window !== "undefined" ? window.prompt(message, opts.value ?? "") : null);
    listener({ kind: "text", message, value: opts.value ?? "", confirmLabel: opts.confirmLabel ?? "저장", resolve });
  });
}

export function DialogHost() {
  const [queue, setQueue] = useState<Req[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const current = queue[0];

  useEffect(() => {
    listener = (r) => setQueue((q) => [...q, r]);
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (current && !d.open) d.showModal();
    if (!current && d.open) d.close();
  }, [current]);

  function finish(ok: boolean) {
    if (!current) return;
    if (current.kind === "confirm") current.resolve(ok);
    else current.resolve(ok ? (inputRef.current?.value ?? "") : null);
    setQueue((q) => q.slice(1));
  }

  return (
    <dialog
      ref={ref}
      aria-label={current?.message ?? "확인"}
      onCancel={(e) => {
        e.preventDefault();
        finish(false);
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm bg-transparent p-0 backdrop:bg-black/50"
    >
      {current && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            finish(true);
          }}
          className="space-y-4 rounded-3xl border-2 border-line bg-surface p-5 text-ink"
        >
          <p role="alert" className="text-base leading-relaxed">
            {current.message}
          </p>
          {current.kind === "text" && (
            <input
              autoFocus
              ref={inputRef}
              key={current.message + current.value}
              defaultValue={current.value}
              aria-label={current.message}
              className="w-full rounded-2xl border-2 border-line bg-surface px-4 py-3 outline-none focus:border-accent"
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" onClick={() => finish(false)}>
              취소
            </Button>
            <Button type="submit" variant={current.kind === "confirm" && current.danger ? "accent" : "primary"}>
              {current.confirmLabel}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
