"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DOW, Empty, PageHeader, formatDateKey, formatMinutes, useSubjectMap } from "@/components/kit";
import { AddTaskSheet } from "@/components/planner/AddTaskSheet";
import { TaskRow } from "@/components/planner/TaskRow";
import { toast } from "@/components/Toaster";
import { Button, Card, ProgressBar, SectionTitle, buttonStyles, cn } from "@/components/ui";
import { getDB } from "@/lib/db";
import { carryOverToToday } from "@/lib/db/study";
import { addDays, daysBetween, parseDateKey, toDateKey } from "@/lib/date";

function weekStart(key: string) {
  const dow = parseDateKey(key).getDay(); // 월요일 시작
  return addDays(key, -((dow + 6) % 7));
}

export default function PlannerPage() {
  const today = toDateKey();
  const [selected, setSelected] = useState(today);
  const [adding, setAdding] = useState(false);
  const start = weekStart(selected);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const subjectMap = useSubjectMap();

  const weekTasks = useLiveQuery(() => getDB().tasks.where("date").between(days[0], days[6], true, true).toArray(), [days[0], days[6]]);
  const pastUndone = useLiveQuery(() => getDB().tasks.where("date").below(today).filter((t) => !t.done).count(), [today]);
  const exams = useLiveQuery(() => getDB().exams.where("date").aboveOrEqual(today).sortBy("date"), [today]);
  const examTasks = useLiveQuery(async () => {
    const all = await getDB().tasks.filter((t) => !!t.examId && t.kind !== "spaced").toArray();
    const map = new Map<string, { done: number; total: number }>();
    for (const t of all) {
      const m = map.get(t.examId!) ?? { done: 0, total: 0 };
      m.total++;
      if (t.done) m.done++;
      map.set(t.examId!, m);
    }
    return map;
  }, []);

  const dayTasks = (weekTasks ?? []).filter((t) => t.date === selected).sort((a, b) => Number(a.done) - Number(b.done) || a.order - b.order);
  const dayMinutes = dayTasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="🗓️ 플래너"
        action={
          <Link href="/planner/exam/new" className={buttonStyles("accent", "sm")}>
            + 시험 계획
          </Link>
        }
      />

      {exams && exams.length > 0 && (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
          {exams.map((e) => {
            const p = examTasks?.get(e.id) ?? { done: 0, total: 0 };
            const dday = daysBetween(today, e.date);
            return (
              <Link key={e.id} href={`/planner/exam?id=${e.id}`} className="min-w-[200px] flex-1 snap-start">
                <Card className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display truncate">{e.title}</span>
                    <span className="font-display shrink-0 text-xl text-danger">{dday === 0 ? "D-DAY" : `D-${dday}`}</span>
                  </div>
                  <ProgressBar value={p.total ? p.done / p.total : 0} color="var(--accent)" label={`${e.title} 진행률`} />
                  <p className="text-xs text-ink-soft">
                    할 일 {p.done}/{p.total} · {formatDateKey(e.date)}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {!!pastUndone && (
        <Card className="flex items-center gap-3 border-xp bg-xp/10">
          <span aria-hidden className="text-2xl">
            📦
          </span>
          <p className="flex-1 text-sm">지난 날 못 끝낸 할 일이 {pastUndone}개 있어요.</p>
          <Button
            size="sm"
            onClick={async () => {
              const n = await carryOverToToday(today);
              setSelected(today);
              toast(`${n}개를 오늘로 가져왔어요`);
            }}
          >
            오늘로
          </Button>
        </Card>
      )}

      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="이전 주" onClick={() => setSelected(addDays(selected, -7))} className="rounded-full px-3 text-xl">
            ‹
          </button>
          <button type="button" className="font-display" onClick={() => setSelected(today)}>
            {formatDateKey(days[0], false)} ~ {formatDateKey(days[6], false)}
          </button>
          <button type="button" aria-label="다음 주" onClick={() => setSelected(addDays(selected, 7))} className="rounded-full px-3 text-xl">
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const ts = (weekTasks ?? []).filter((t) => t.date === d);
            const done = ts.filter((t) => t.done).length;
            const exam = exams?.find((e) => e.date === d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={d === selected}
                aria-label={`${formatDateKey(d)} 할 일 ${ts.length}개`}
                onClick={() => setSelected(d)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-2xl border-2 py-1.5",
                  d === selected ? "border-primary bg-bg-soft" : "border-transparent",
                  d === today && d !== selected && "border-line",
                )}
              >
                <span className={cn("text-xs", parseDateKey(d).getDay() === 0 ? "text-danger" : "text-ink-soft")}>{DOW[parseDateKey(d).getDay()]}</span>
                <span className="font-display">{parseDateKey(d).getDate()}</span>
                <span className="h-2 text-[10px] leading-none">
                  {exam ? "📝" : ts.length > 0 ? <span className={cn("inline-block size-2 rounded-full", done === ts.length ? "bg-success" : "bg-primary")} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <section>
        <SectionTitle
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              + 할 일
            </Button>
          }
        >
          {selected === today ? "오늘" : formatDateKey(selected)}
          {dayMinutes > 0 && <span className="ml-2 text-sm text-ink-soft">약 {formatMinutes(dayMinutes)}</span>}
        </SectionTitle>
        {dayTasks.length === 0 ? (
          <Card>
            <Empty icon="📭">
              할 일이 없어요.
              <br />
              시험이 다가오면 <b>시험 계획</b>으로 할 일을 자동으로 만들어 보세요.
            </Empty>
          </Card>
        ) : (
          <ul className="space-y-2">
            {dayTasks.map((t) => (
              <TaskRow key={t.id} task={t} subject={t.subjectId ? subjectMap.get(t.subjectId) : undefined} />
            ))}
          </ul>
        )}
      </section>

      <AddTaskSheet open={adding} onClose={() => setAdding(false)} date={selected} />
    </div>
  );
}
