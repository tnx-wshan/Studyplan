"use client";

import "katex/dist/katex.min.css";
import katex from "katex";
import { Fragment, useMemo } from "react";
import { letters, parseBlanks } from "@/lib/learn/check";
import type { BlankStep, ChoiceStep, PuzzleStep, ShortStep, SummaryStep } from "@/lib/learn/types";
import { Markdown } from "../Markdown";
import { cn } from "../ui";
import { MathInput } from "./MathInput";

/** 짧은 글 안의 $수식$만 그린다 (단추·낱말 조각처럼 문단을 넣을 수 없는 곳용) */
export function InlineText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => text.split(/(\$[^$]+\$)/g).filter(Boolean), [text]);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith("$") && p.endsWith("$") && p.length > 2 ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(p.slice(1, -1), { throwOnError: false, strict: "ignore" }) }} />
        ) : (
          <Fragment key={i}>{p.replace(/\*\*/g, "")}</Fragment>
        ),
      )}
    </span>
  );
}

export function SummaryView({ step }: { step: SummaryStep }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft">핵심 정리</p>
      <h2 className="font-display text-2xl">{step.title}</h2>
      <Markdown className="text-[17px] leading-relaxed">{step.body}</Markdown>
      {step.points.length > 0 && (
        <div className="rounded-2xl bg-xp/10 p-3">
          <p className="font-display mb-1 text-sm">⭐ 꼭 기억하기</p>
          <ul className="space-y-1">
            {step.points.map((p) => (
              <li key={p} className="flex gap-1.5">
                <span aria-hidden>•</span>
                <InlineText text={p} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ChoiceView({ step, choices, value, onChange, locked, correct }: { step: ChoiceStep; choices: string[]; value: string | null; onChange: (v: string) => void; locked: boolean; correct: boolean | null }) {
  return (
    <div className="space-y-4">
      <Prompt label="객관식" text={step.prompt} />
      <div className="space-y-2" role="radiogroup" aria-label="보기">
        {choices.map((c) => {
          const picked = value === c;
          const showRight = locked && c === step.answer;
          const showWrong = locked && picked && !correct;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={picked}
              disabled={locked}
              onClick={() => onChange(c)}
              className={cn(
                "w-full rounded-2xl border-2 bg-surface px-4 py-3 text-left text-[17px] transition-colors",
                picked && !locked && "border-accent bg-accent/10",
                !picked && !showRight && "border-line",
                showRight && "border-success bg-success/15",
                showWrong && "border-danger bg-danger/10",
              )}
            >
              <InlineText text={c} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ShortView({ step, value, onChange, onSubmit, locked, math }: { step: ShortStep; value: string; onChange: (v: string) => void; onSubmit: () => void; locked: boolean; math: boolean }) {
  return (
    <div className="space-y-4">
      <Prompt label="주관식" text={step.prompt} />
      <MathInput value={value} onChange={onChange} onSubmit={onSubmit} disabled={locked} defaultOpen={math || !!step.math} />
    </div>
  );
}

export function BlankView({ step, words, value, onChange, locked }: { step: BlankStep; words: string[]; value: (string | null)[]; onChange: (v: (string | null)[]) => void; locked: boolean }) {
  const parts = useMemo(() => parseBlanks(step.text), [step.text]);
  // 같은 낱말이 두 번 나올 수 있으므로 몇 번 썼는지 센다
  const usedCount = (w: string) => value.filter((x) => x === w).length;
  const available = (w: string, i: number) => usedCount(w) < words.slice(0, i + 1).filter((x) => x === w).length;

  function fill(word: string) {
    const i = value.findIndex((x) => x === null);
    if (i < 0) return;
    const next = [...value];
    next[i] = word;
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <Prompt label="빈칸 채우기" text={step.prompt} />
      <p className="rounded-2xl border-2 border-line bg-surface p-4 text-[17px] leading-[2.4]">
        {parts.map((p, i) =>
          p.kind === "text" ? (
            <InlineText key={i} text={p.text} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={locked || !value[p.index]}
              onClick={() => {
                const next = [...value];
                next[p.index] = null;
                onChange(next);
              }}
              aria-label={`빈칸 ${p.index + 1}: ${value[p.index] ?? "비어 있음"}`}
              className={cn(
                "mx-1 inline-block min-w-16 border-b-2 px-2 text-center font-display leading-normal",
                value[p.index] ? "rounded-lg border-accent bg-accent/10" : "border-ink-soft",
              )}
            >
              {value[p.index] ?? " "}
            </button>
          ),
        )}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="낱말 상자">
        {words.map((w, i) => (
          <button
            key={`${w}-${i}`}
            type="button"
            disabled={locked || !available(w, i) || !value.includes(null)}
            onClick={() => fill(w)}
            className="font-display rounded-2xl border-2 border-line bg-surface px-4 py-2 shadow-[0_3px_0_var(--line)] disabled:opacity-40"
          >
            <InlineText text={w} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function PuzzleView({ step, tiles, picked, onChange, locked }: { step: PuzzleStep; tiles: string[]; picked: number[]; onChange: (v: number[]) => void; locked: boolean }) {
  const size = letters(step.answer).length;
  return (
    <div className="space-y-4">
      <Prompt label="낱말 퍼즐" text={step.prompt} />
      <div className="flex justify-center gap-1.5" aria-label={`정답 칸 ${size}개: ${picked.map((i) => tiles[i]).join("") || "비어 있음"}`} role="status">
        {Array.from({ length: size }, (_, i) => (
          <span key={i} className={cn("font-display flex size-12 items-center justify-center rounded-xl border-2 text-xl", picked[i] !== undefined ? "border-accent bg-accent/10" : "border-dashed border-line")}>
            {picked[i] !== undefined ? tiles[picked[i]] : ""}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="글자 조각">
        {tiles.map((t, i) => (
          <button
            key={i}
            type="button"
            disabled={locked || picked.includes(i) || picked.length >= size}
            onClick={() => onChange([...picked, i])}
            className="font-display size-12 rounded-xl border-2 border-line bg-surface text-xl shadow-[0_3px_0_var(--line)] disabled:opacity-30"
          >
            {t}
          </button>
        ))}
      </div>
      {!locked && (
        <div className="flex justify-center gap-2">
          <button type="button" className="rounded-full border-2 border-line px-3 py-1 text-sm" disabled={picked.length === 0} onClick={() => onChange(picked.slice(0, -1))}>
            ⌫ 한 글자 지우기
          </button>
          <button type="button" className="rounded-full border-2 border-line px-3 py-1 text-sm" disabled={picked.length === 0} onClick={() => onChange([])}>
            처음부터
          </button>
        </div>
      )}
    </div>
  );
}

function Prompt({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-ink-soft">{label}</p>
      <Markdown className="font-display text-xl leading-snug">{text}</Markdown>
    </div>
  );
}
