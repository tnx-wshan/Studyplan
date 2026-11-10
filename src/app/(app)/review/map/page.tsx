"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { ForecastChart } from "@/components/ForecastChart";
import { Empty, PageHeader, Sheet, SubjectPicker, useSubjects } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { Button, Card, ProgressBar, SectionTitle, buttonStyles, cn } from "@/components/ui";
import { unitsForSubject } from "@/data/curriculum";
import { getDB } from "@/lib/db";
import { addReviewTask } from "@/lib/db/study";
import type { Subject } from "@/lib/db/types";
import { toDateKey } from "@/lib/date";
import { computeMemory, memoryKey, reviewForecast, type MemoryStatus, type UnitMemory } from "@/lib/study/memory";
import { useMinuteTick } from "@/lib/timerStore";

const STATUS: Record<MemoryStatus, { label: string; icon: string; color: string }> = {
  fresh: { label: "선명", icon: "🟢", color: "var(--success)" },
  fading: { label: "흐려지는 중", icon: "🟡", color: "var(--xp)" },
  risk: { label: "잊기 직전", icon: "🔴", color: "var(--danger)" },
};

interface Row {
  subject: Subject;
  unit: string;
  memory?: UnitMemory;
}

export default function MemoryMapPage() {
  const today = toDateKey();
  const tick = useMinuteTick();
  const subjects = useSubjects() ?? [];
  const [subjectId, setSubjectId] = useState<string>();
  const [selected, setSelected] = useState<Row | null>(null);
  const data = useLiveQuery(async () => {
    const db = getDB();
    const [tasks, wrong, cards] = await Promise.all([db.tasks.toArray(), db.wrongAnswers.toArray(), db.cards.toArray()]);
    return { memory: computeMemory(tasks, wrong, Date.now()), forecast: reviewForecast(cards, wrong, tasks, today, 7) };
  }, [today, tick]);
  if (!data) return null;

  const rows: Row[] = subjects
    .filter((s) => !subjectId || s.id === subjectId)
    .flatMap((s) => {
      // 교육과정 단원 + 기록에만 있는 단원
      const fromRecords = [...data.memory.values()].filter((m) => m.subjectId === s.id).map((m) => m.unit);
      return [...new Set([...unitsForSubject(s), ...fromRecords])].map((unit) => ({ subject: s, unit, memory: data.memory.get(memoryKey(s.id, unit)) }));
    });
  const studied = rows.filter((r) => r.memory).sort((a, b) => a.memory!.retention - b.memory!.retention);
  const untouched = rows.filter((r) => !r.memory);
  const count = (st: MemoryStatus) => studied.filter((r) => r.memory!.status === st).length;

  return (
    <div className="space-y-5">
      <PageHeader title="🧠 기억 지도" back="/review" />

      <section>
        <SectionTitle>복습 예보</SectionTitle>
        <Card>
          <ForecastChart days={data.forecast} today={today} />
        </Card>
      </section>

      <SubjectPicker subjects={subjects} value={subjectId} onChange={setSubjectId} allowNone noneLabel="전체" />

      <div className="grid grid-cols-4 gap-2 text-center">
        {(["risk", "fading", "fresh"] as MemoryStatus[]).map((st) => (
          <Card key={st} className="p-2">
            <p className="font-display text-xl">{count(st)}</p>
            <p className="text-[11px] text-ink-soft">
              {STATUS[st].icon} {STATUS[st].label}
            </p>
          </Card>
        ))}
        <Card className="p-2">
          <p className="font-display text-xl">{untouched.length}</p>
          <p className="text-[11px] text-ink-soft">⚪ 아직 안 배움</p>
        </Card>
      </div>

      <section>
        <SectionTitle>배운 단원 (잊기 쉬운 순)</SectionTitle>
        {studied.length === 0 ? (
          <Card>
            <Empty icon="🧠">
              플래너에서 단원을 골라 할 일을 끝내면 여기에 기억 상태가 나타나요.
              <br />
              시간이 지나면 흐려지고, 복습하면 다시 선명해져요.
            </Empty>
          </Card>
        ) : (
          <ul className="space-y-2">
            {studied.map((r) => {
              const m = r.memory!;
              const st = STATUS[m.status];
              return (
                <li key={memoryKey(r.subject.id, r.unit)}>
                  <button type="button" onClick={() => setSelected(r)} className="card relative w-full rounded-3xl border-2 border-line bg-surface p-3 text-left">
                    <span className="flex items-center gap-2">
                      <span className="inline-block size-3 shrink-0 rounded-full" style={{ background: r.subject.color }} />
                      <span className="min-w-0 flex-1 truncate">{r.unit}</span>
                      <span className="shrink-0 text-xs text-ink-soft">
                        {st.icon} {st.label}
                      </span>
                      <span className="font-display w-11 shrink-0 text-right tabular-nums">{m.retention}%</span>
                    </span>
                    <ProgressBar value={m.retention / 100} className="mt-2 h-2 border-0" color={st.color} label={`${r.unit} 추정 기억률`} />
                    <span className="mt-1 block text-xs text-ink-soft">
                      {r.subject.name} · {m.daysSince === 0 ? "오늘" : `${m.daysSince}일 전`} 공부 · {m.reviews}번 봄{m.openWrong > 0 ? ` · 오답 ${m.openWrong}개` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {untouched.length > 0 && (
        <section>
          <SectionTitle>아직 안 배운 단원</SectionTitle>
          <Card className="flex flex-wrap gap-1.5">
            {untouched.slice(0, 40).map((r) => (
              <span key={memoryKey(r.subject.id, r.unit)} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft">
                {r.unit}
              </span>
            ))}
            {untouched.length > 40 && <span className="px-2 py-1 text-xs text-ink-soft">외 {untouched.length - 40}개</span>}
          </Card>
        </section>
      )}

      <p className="text-xs text-ink-soft">기억률은 공부한 날짜와 복습 횟수로 어림한 값이에요(망각 곡선). 실제 기억은 직접 떠올려 봐야 알 수 있어요.</p>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.unit ?? ""}>
        {selected?.memory && (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              {selected.subject.name} · 추정 기억률 <b className="font-display text-ink">{selected.memory.retention}%</b> · 마지막 공부 {selected.memory.daysSince === 0 ? "오늘" : `${selected.memory.daysSince}일 전`}
            </p>
            <p className="text-sm">{selected.memory.status === "fresh" ? "아직 선명해요. 조금 더 지난 뒤에 꺼내 보면 더 오래 남아요." : "지금 다시 꺼내 보기 딱 좋은 때예요. 보지 않고 떠올려 보세요."}</p>
            <Button
              className="w-full"
              onClick={async () => {
                const added = await addReviewTask(selected.subject.id, selected.unit, today);
                toast(added ? "오늘 할 일에 복습을 넣었어요" : "이미 오늘 할 일에 있어요");
                setSelected(null);
              }}
            >
              🗓️ 오늘 복습 할 일로 넣기
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/methods/practice?id=blank" className={buttonStyles("ghost", "md")}>
                📄 백지 복습
              </Link>
              <Link href="/ai/create" className={cn(buttonStyles("ghost", "md"))}>
                ✨ AI 문제 만들기
              </Link>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
