"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { UnitState } from "@/lib/learn/engine";
import type { CourseOutline } from "@/lib/learn/types";
import type { MapSkin } from "@/lib/game/rewards";
import { CharacterArt } from "../game/CharacterArt";
import { cn } from "../ui";

type Section = CourseOutline["sections"][number];
type Unit = Section["units"][number];

export const STATE_LABEL: Record<UnitState, string> = { done: "완료", current: "지금 할 유닛", open: "열림", locked: "잠김" };

/** 듀오링고처럼 길이 좌우로 굽이친다 (가운데 기준 px) */
const WAVE = [0, 46, 70, 46, 0, -46, -70, -46];

/** 처음 풀 때 맞힌 비율로 별 1~3개 (관리자가 완료로 표시한 유닛은 별 없음) */
export function starsFor(best: { bestCorrect: number; total: number } | undefined): number {
  if (!best || best.total === 0) return 0;
  const r = best.bestCorrect / best.total;
  return r >= 0.9 ? 3 : r >= 0.6 ? 2 : 1;
}

/**
 * 섹션 하나의 학습 길: 섹션 띠 → 굽이치는 유닛 단추 → 섹션 끝 트로피.
 * 지금 할 유닛이 있는 섹션에는 동료가 길 옆에 서서 응원한다.
 */
export function SectionPath({
  section,
  index,
  states,
  best,
  noir,
  skin = "basic",
}: {
  section: Section;
  index: number;
  states: Map<string, UnitState>;
  best: Map<string, { bestCorrect: number; total: number }>;
  noir: boolean;
  skin?: MapSkin;
}) {
  const doneCount = section.units.filter((u) => states.get(u.id) === "done").length;
  const complete = section.units.length > 0 && doneCount === section.units.length;
  const hasCurrent = section.units.some((u) => states.get(u.id) === "current");
  return (
    <li className="space-y-4">
      <div className={cn("flex items-center gap-3 border-l-8 bg-surface-2 px-3 py-2.5", noir ? "rounded-sm" : "rounded-2xl", complete ? "border-success" : hasCurrent ? "border-primary" : "border-line")}>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-soft">
            섹션 {index + 1}
            {complete && " · 완료"}
          </p>
          <h2 className="font-display truncate text-lg">{section.title}</h2>
          {section.description && <p className="text-xs text-ink-soft">{section.description}</p>}
        </div>
        <span className="font-display shrink-0 text-sm text-ink-soft">{section.units.length ? `${doneCount}/${section.units.length}` : "준비 중"}</span>
      </div>

      {section.units.length === 0 ? (
        <p className="text-center text-sm text-ink-soft">유닛을 준비하고 있어요.</p>
      ) : (
        <div className={cn("relative", skin !== "basic" && `map-skin map-skin-${skin}`)}>
          {hasCurrent && <Mascot noir={noir} />}
          <ul className="flex flex-col items-center gap-5 pb-1 pt-8">
            {section.units.map((u, i) => (
              <UnitNode key={u.id} unit={u} state={states.get(u.id) ?? "locked"} stars={starsFor(best.get(u.id))} x={WAVE[i % WAVE.length]} noir={noir} />
            ))}
            <li aria-hidden className="flex flex-col items-center" style={{ transform: `translateX(${WAVE[section.units.length % WAVE.length]}px)` }}>
              <span className={cn("flex size-14 items-center justify-center text-2xl", noir ? "rounded-sm" : "rounded-full", complete ? "bg-xp/30" : "bg-surface-2 opacity-60")}>🏆</span>
            </li>
          </ul>
        </div>
      )}
    </li>
  );
}

function UnitNode({ unit, state, stars, x, noir }: { unit: Unit; state: UnitState; stars: number; x: number; noir: boolean }) {
  const icon = state === "done" ? "✓" : state === "locked" ? "🔒" : "★";
  const circle = cn(
    "relative flex size-16 items-center justify-center text-2xl font-display transition-transform active:translate-y-1",
    noir ? "rounded-sm" : "rounded-full",
    state === "done" && "bg-success text-white shadow-[0_6px_0_var(--success-shadow)]",
    state === "current" && "bg-primary text-white shadow-[0_6px_0_var(--primary-shadow)] ring-4 ring-primary/30 ring-offset-4 ring-offset-bg",
    state === "open" && "border-2 border-accent bg-surface text-accent-deep shadow-[0_6px_0_var(--line)]",
    state === "locked" && "bg-surface-2 text-ink-soft shadow-[0_6px_0_var(--line)]",
  );
  const style: CSSProperties = { transform: `translateX(${x}px)` };
  const label = (
    <>
      <span className="relative">
        {state === "current" && (
          <span aria-hidden className={cn("font-display absolute -top-9 left-1/2 -translate-x-1/2 animate-bounce whitespace-nowrap border-2 border-primary bg-surface px-2 py-0.5 text-xs text-primary-deep", noir ? "rounded-sm" : "rounded-xl")}>
            {noir ? "시작" : "시작!"}
          </span>
        )}
        <span aria-hidden className={circle}>
          {icon}
        </span>
      </span>
      {state === "done" && (
        <span aria-hidden className="text-sm leading-none tracking-tight">
          <span className="text-xp-deep">{"★".repeat(stars)}</span>
          <span className="text-line">{"★".repeat(stars ? 3 - stars : 0)}</span>
        </span>
      )}
      <span className={cn("font-display max-w-36 text-center text-xs leading-tight", state === "locked" ? "text-ink-soft" : "text-ink")}>{unit.title}</span>
    </>
  );
  return (
    <li style={style}>
      {state === "locked" ? (
        <button type="button" disabled className="flex flex-col items-center gap-1.5" aria-label={`${unit.title} (잠김: 앞 유닛을 먼저 끝내세요)`}>
          {label}
        </button>
      ) : (
        <Link
          href={`/learn/lesson?unit=${unit.id}`}
          className="flex flex-col items-center gap-1.5"
          aria-label={`${unit.title} (${STATE_LABEL[state]})${stars ? ` · 별 ${stars}개` : ""} · 약 ${unit.minutes}분 · 문제 ${unit.questionCount}개`}
        >
          {label}
        </Link>
      )}
    </li>
  );
}

/** 지금 할 유닛 옆에서 응원하는 동료 */
function Mascot({ noir }: { noir: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute -right-1 top-6 flex flex-col items-end">
      <CharacterArt mood="excited" size={76} />
      <span className={cn("font-display -mt-1 bg-surface px-2 py-0.5 text-[11px] shadow-[var(--shadow)] border-2 border-line", noir ? "rounded-sm" : "rounded-xl")}>{noir ? "곁에 있다." : "같이 가요!"}</span>
    </div>
  );
}
