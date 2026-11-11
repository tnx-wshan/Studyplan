"use client";

import "katex/dist/katex.min.css";
import katex from "katex";
import { useMemo, useRef, useState } from "react";
import { toLatex } from "@/lib/learn/latex";
import { cn } from "../ui";
import { fieldClass } from "../kit";

/** 수식 도구의 단추: 보이는 글자, 넣을 글자, 읽어 줄 이름 */
const KEYS: { label: string; insert: string; name: string; cursorBack?: number }[] = [
  { label: "x²", insert: "²", name: "제곱" },
  { label: "xⁿ", insert: "^", name: "거듭제곱" },
  { label: "√", insert: "√()", name: "제곱근", cursorBack: 1 },
  { label: "a/b", insert: "/", name: "분수" },
  { label: "(", insert: "(", name: "여는 괄호" },
  { label: ")", insert: ")", name: "닫는 괄호" },
  { label: "×", insert: "×", name: "곱하기" },
  { label: "÷", insert: "÷", name: "나누기" },
  { label: "−", insert: "-", name: "빼기" },
  { label: "±", insert: "±", name: "플러스마이너스" },
  { label: "π", insert: "π", name: "파이" },
  { label: "≤", insert: "≤", name: "작거나 같다" },
  { label: "≥", insert: "≥", name: "크거나 같다" },
  { label: "≠", insert: "≠", name: "같지 않다" },
  { label: "x", insert: "x", name: "x" },
  { label: "y", insert: "y", name: "y" },
];

export function MathInput({
  value,
  onChange,
  onSubmit,
  disabled,
  defaultOpen = true,
  label = "답",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  defaultOpen?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const preview = useMemo(() => {
    if (!value.trim()) return "";
    try {
      return katex.renderToString(toLatex(value), { throwOnError: false, strict: "ignore", output: "html" });
    } catch {
      return "";
    }
  }, [value]);

  function insert(text: string, back = 0) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    const pos = start + text.length - back;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function backspace() {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    if (start === end && start === 0) return;
    const from = start === end ? start - 1 : start;
    onChange(value.slice(0, from) + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(from, from);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          ref={ref}
          aria-label={label}
          value={value}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="답을 쓰세요"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSubmit?.();
            }
          }}
          className={cn(fieldClass, "flex-1 text-lg")}
        />
        <button
          type="button"
          aria-pressed={open}
          aria-label="수식 도구"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={cn("font-display shrink-0 rounded-2xl border-2 px-3 text-lg", open ? "border-accent bg-accent text-white" : "border-line bg-surface")}
        >
          ∑
        </button>
      </div>
      {preview && (
        <output className="block min-h-8 overflow-x-auto rounded-2xl bg-surface-2 px-3 py-1.5 text-lg" aria-label="수식 미리 보기">
          <span dangerouslySetInnerHTML={{ __html: preview }} />
        </output>
      )}
      {open && !disabled && (
        <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="수식 기호">
          {KEYS.map((k) => (
            <button
              key={k.name}
              type="button"
              aria-label={k.name}
              onClick={() => insert(k.insert, k.cursorBack)}
              className="rounded-xl border-2 border-line bg-surface py-2 font-mono text-base active:translate-y-px"
            >
              {k.label}
            </button>
          ))}
          <button type="button" aria-label="한 글자 지우기" onClick={backspace} className="col-span-2 rounded-xl border-2 border-line bg-surface py-2 text-base">
            ⌫
          </button>
        </div>
      )}
    </div>
  );
}
