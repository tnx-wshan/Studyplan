"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Empty, PageHeader, formatDateKey, formatMinutes, useSubjectMap } from "@/components/kit";
import { Card, SectionTitle } from "@/components/ui";
import { getDB } from "@/lib/db";
import { addDays, parseDateKey, toDateKey } from "@/lib/date";
import { useStudyDays } from "@/lib/hooks";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export default function GrowthPage() {
  const today = toDateKey();
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const study = useStudyDays();
  const subjectMap = useSubjectMap();
  const data = useLiveQuery(async () => {
    const db = getDB();
    const [sessions, weekTasks] = await Promise.all([db.studySessions.toArray(), db.tasks.where("date").between(week[0], today, true, true).toArray()]);
    const byDay = new Map(week.map((d) => [d, 0]));
    const bySubject = new Map<string, number>();
    let total = 0;
    for (const s of sessions) {
      total += s.focusMinutes;
      if (byDay.has(s.date)) {
        byDay.set(s.date, byDay.get(s.date)! + s.focusMinutes);
        const key = s.subjectId ?? "none";
        bySubject.set(key, (bySubject.get(key) ?? 0) + s.focusMinutes);
      }
    }
    return {
      total,
      byDay: week.map((d) => ({ date: d, minutes: byDay.get(d)! })),
      bySubject: [...bySubject.entries()].sort((a, b) => b[1] - a[1]),
      tasksDone: weekTasks.filter((t) => t.done).length,
      tasksTotal: weekTasks.length,
    };
  }, [today]);

  if (!data || !study) return null;
  const weekMinutes = data.byDay.reduce((s, d) => s + d.minutes, 0);
  const todayMinutes = data.byDay[6].minutes;
  const rate = data.tasksTotal ? Math.round((data.tasksDone / data.tasksTotal) * 100) : null;

  return (
    <div className="space-y-5">
      <PageHeader title="🌱 성장" />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="오늘 집중" value={formatMinutes(todayMinutes)} />
        <Stat label="최근 7일" value={formatMinutes(weekMinutes)} sub={`하루 평균 ${formatMinutes(Math.round(weekMinutes / 7))}`} />
        <Stat label="연속 학습" value={`${study.streak.current}일`} sub={`최장 ${study.streak.longest}일`} />
        <Stat label="7일 계획 달성률" value={rate === null ? "-" : `${rate}%`} sub={`${data.tasksDone}/${data.tasksTotal}개 완료`} />
      </div>

      <section>
        <SectionTitle>최근 7일 집중 시간</SectionTitle>
        <Card>
          {weekMinutes === 0 ? <Empty icon="📊">집중 타이머로 공부하면 여기에 기록이 쌓여요.</Empty> : <DayColumns days={data.byDay} today={today} />}
        </Card>
      </section>

      <section>
        <SectionTitle>최근 7일 과목별</SectionTitle>
        <Card>
          {data.bySubject.length === 0 ? (
            <Empty icon="📚">아직 과목별 기록이 없어요.</Empty>
          ) : (
            <ul className="space-y-3">
              {data.bySubject.map(([id, minutes]) => {
                const s = subjectMap.get(id);
                const max = data.bySubject[0][1];
                return (
                  <li key={id} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-sm" aria-label={`${s?.name ?? "과목 없음"} ${formatMinutes(minutes)}`}>
                    <span className="truncate">{s?.name ?? "과목 없음"}</span>
                    <span className="h-4">
                      <span
                        className="mark block h-4 rounded-r-[4px]"
                        style={{ width: `${Math.max(2, (minutes / max) * 100)}%`, ["--c" as string]: s?.color ?? "var(--ink-soft)" }}
                      />
                    </span>
                    <span className="font-display tabular-nums">{formatMinutes(minutes)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <Card className="text-sm text-ink-soft">🔒 주간 리포트, 회고 일기, 배지 모음은 3·4단계에서 열려요.</Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="font-display text-2xl">{value}</p>
      {sub && <p className="text-xs text-ink-soft">{sub}</p>}
    </Card>
  );
}

function DayColumns({ days, today }: { days: { date: string; minutes: number }[]; today: string }) {
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
        <div className="relative grid h-full grid-cols-7">
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
      <div className="mt-1 grid grid-cols-7 text-center text-xs text-ink-soft">
        {days.map((d) => (
          <span key={d.date} className={d.date === today ? "font-display text-ink" : undefined}>
            {d.date === today ? "오늘" : DOW[parseDateKey(d.date).getDay()]}
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
