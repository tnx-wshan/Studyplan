"use client";

import { useState } from "react";
import { formatDateKey } from "./kit";
import { parseDateKey } from "@/lib/date";
import type { ForecastDay } from "@/lib/study/memory";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** 앞으로 7일 복습량 막대. 날짜를 누르면 카드·오답·간격 복습으로 나눠 보여준다. */
export function ForecastChart({ days, today }: { days: ForecastDay[]; today: string }) {
  // 기본으로 내일을 보여준다
  const [active, setActive] = useState(days[1]?.date ?? days[0].date);
  const max = Math.max(1, ...days.map((d) => d.total));
  const shown = days.find((d) => d.date === active) ?? days[0];
  const label = (d: ForecastDay) => (d.date === today ? "오늘" : d.date === days[1]?.date ? "내일" : DOW[parseDateKey(d.date).getDay()]);

  return (
    <div>
      <p className="mb-2 text-sm" aria-live="polite">
        <b className="font-display">{shown.date === today ? "오늘" : shown.date === days[1]?.date ? "내일" : formatDateKey(shown.date)}</b>{" "}
        {shown.total === 0 ? (
          <span className="text-ink-soft">복습할 것이 없어요</span>
        ) : (
          <>
            복습 <b className="font-display">{shown.total}개</b>
            <span className="text-ink-soft">
              {" "}
              · 카드 {shown.cards} · 오답 {shown.wrong} · 간격 복습 {shown.spaced}
            </span>
          </>
        )}
      </p>
      <div className="grid h-24 grid-cols-7 items-end border-b-2 border-line">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            aria-pressed={d.date === active}
            aria-label={`${formatDateKey(d.date)} 복습 ${d.total}개`}
            onClick={() => setActive(d.date)}
            className="flex h-full flex-col items-center justify-end rounded-t-lg outline-offset-2 hover:bg-surface-2"
          >
            {d.total > 0 && <span className="mb-0.5 text-[10px] tabular-nums text-ink-soft">{d.total}</span>}
            <span className="mark block w-full max-w-6 rounded-t-[4px]" style={{ height: `${(d.total / max) * 75}%`, ["--c" as string]: "var(--accent)", opacity: d.date === active ? 1 : 0.5 }} />
          </button>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 text-center text-xs text-ink-soft">
        {days.map((d) => (
          <span key={d.date} className={d.date === active ? "font-display text-ink" : undefined}>
            {label(d)}
          </span>
        ))}
      </div>
    </div>
  );
}
