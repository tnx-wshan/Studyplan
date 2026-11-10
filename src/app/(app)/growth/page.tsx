"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Empty, PageHeader, formatMinutes, useSubjectMap } from "@/components/kit";
import Link from "next/link";
import { buttonStyles } from "@/components/ui";
import { Card, SectionTitle } from "@/components/ui";
import { getDB } from "@/lib/db";
import { addDays, toDateKey } from "@/lib/date";
import { DayColumns, SubjectBars } from "@/components/charts";
import { useStudyDays } from "@/lib/hooks";

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
            <SubjectBars items={data.bySubject.map(([subjectId, minutes]) => ({ subjectId, minutes }))} subjectMap={subjectMap} />
          )}
        </Card>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/growth/report" className={buttonStyles("accent", "lg", "flex-col gap-0 py-4")}>
          <span className="text-2xl">📊</span>
          주간·월간 리포트
        </Link>
        <Link href="/growth/report#reflection" className={buttonStyles("primary", "lg", "flex-col gap-0 py-4")}>
          <span className="text-2xl">✍️</span>
          이번 주 회고
        </Link>
      </div>
      <Link href="/growth/badges" className={buttonStyles("ghost", "md", "w-full")}>
        🏆 업적과 칭호
      </Link>
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
