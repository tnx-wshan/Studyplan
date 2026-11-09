"use client";

import { useState } from "react";
import { formatDateKey, formatMinutes } from "@/components/kit";
import type { Subject } from "@/lib/db/types";
import { parseDateKey } from "@/lib/date";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** 과목별 집중 시간 가로 막대 (이름과 시간을 글자로 함께 표시) */
export function SubjectBars({ items, subjectMap }: { items: { subjectId: string; minutes: number }[]; subjectMap: Map<string, Subject> }) {
  const max = Math.max(1, ...items.map((i) => i.minutes));
  return (
    <ul className="space-y-3">
      {items.map(({ subjectId, minutes }) => {
        const s = subjectMap.get(subjectId);
        return (
          <li key={subjectId} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-sm" aria-label={`${s?.name ?? "과목 없음"} ${formatMinutes(minutes)}`}>
            <span className="truncate">{s?.name ?? "과목 없음"}</span>
            <span className="h-4">
              <span className="mark block h-4 rounded-r-[4px]" style={{ width: `${Math.max(2, (minutes / max) * 100)}%`, ["--c" as string]: s?.color ?? "var(--ink-soft)" }} />
            </span>
            <span className="font-display tabular-nums">{formatMinutes(minutes)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function DayColumns({ days, today }: { days: { date: string; minutes: number }[]; today: string }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...days.map((d) => d.minutes));
  const top = Math.max(30, Math.ceil(max / 30) * 30); // 30분 단위로 축 위쪽을 맞춘다
  const peak = days.find((d) => d.minutes === max)?.date;
  const shown = days.find((d) => d.date === active);

  return (
    <div>
      <div className="mb-1 flex h-5 items-center justify-between text-xs text-ink-soft">
        <span>{formatMinutes(top)}</span>
        {shown && (
          <span className="font-display text-ink" aria-live="polite">
            {formatDateKey(shown.date)} · {formatMinutes(shown.minutes)}
          </span>
        )}
      </div>
      <div className="relative h-36 border-b-2 border-line">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" aria-hidden />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" aria-hidden />
        <div className="relative grid h-full" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const label = d.date === peak || d.date === today ? formatMinutes(d.minutes) : null;
            return (
              <button
                key={d.date}
                type="button"
                aria-label={`${formatDateKey(d.date)} ${formatMinutes(d.minutes)}`}
                onMouseEnter={() => setActive(d.date)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(d.date)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(active === d.date ? null : d.date)}
                className="flex h-full flex-col items-center justify-end rounded-t-lg outline-offset-2 hover:bg-surface-2"
              >
                {label && d.minutes > 0 && <span className="mb-0.5 text-[10px] tabular-nums text-ink-soft">{label}</span>}
                <span
                  className="mark block w-full max-w-6 rounded-t-[4px]"
                  style={{ height: `${(d.minutes / top) * 100}%`, ["--c" as string]: "var(--primary)", opacity: active && active !== d.date ? 0.5 : 1 }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1 grid text-center text-xs text-ink-soft" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d) => (
          <span key={d.date} className={d.date === today ? "font-display text-ink" : undefined}>
            {days.length > 7 ? (parseDateKey(d.date).getDate() % 5 === 1 ? parseDateKey(d.date).getDate() : "") : d.date === today ? "오늘" : DOW[parseDateKey(d.date).getDay()]}
          </span>
        ))}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-soft">표로 보기</summary>
        <table className="mt-2 w-full">
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-t border-line">
                <td className="py-1">{formatDateKey(d.date)}</td>
                <td className="py-1 text-right tabular-nums">{formatMinutes(d.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
