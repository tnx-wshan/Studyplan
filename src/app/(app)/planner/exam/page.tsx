"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Empty, PageHeader, formatDateKey, useSubjectMap } from "@/components/kit";
import { TaskRow } from "@/components/planner/TaskRow";
import { EditExamSheet } from "@/components/planner/EditExam";
import { ExamResults } from "@/components/planner/ExamResults";
import { toast } from "@/components/Toaster";
import { Button, Card, ProgressBar, SectionTitle } from "@/components/ui";
import { getDB } from "@/lib/db";
import { deleteExam, replanExam } from "@/lib/db/study";
import { daysBetween, toDateKey } from "@/lib/date";
import { askConfirm } from "@/components/Dialogs";

export default function ExamPage() {
  return (
    <Suspense fallback={null}>
      <ExamDetail />
    </Suspense>
  );
}

function ExamDetail() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const today = toDateKey();
  const subjectMap = useSubjectMap();
  const [editing, setEditing] = useState(false);
  const exam = useLiveQuery(async () => (await getDB().exams.get(id)) ?? null, [id]);
  const tasks = useLiveQuery(() => getDB().tasks.where("examId").equals(id).toArray(), [id]);

  if (exam === undefined || !tasks) return null;
  if (exam === null) {
    return (
      <>
        <PageHeader title="시험" back="/planner" />
        <Card>
          <Empty icon="🔍">시험을 찾을 수 없어요.</Empty>
        </Card>
      </>
    );
  }

  const main = tasks.filter((t) => t.kind !== "spaced");
  const done = main.filter((t) => t.done).length;
  const dday = daysBetween(today, exam.date);
  const lateCount = main.filter((t) => !t.done && t.date < today).length;
  const upcoming = tasks.filter((t) => !t.done && t.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const byDate = new Map<string, typeof upcoming>();
  for (const t of upcoming) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);

  async function onReplan() {
    if (!(await askConfirm("끝낸 단원은 빼고, 남은 단원으로 오늘부터 계획을 다시 짤까요?"))) return;
    const plan = await replanExam(id, today);
    toast(plan.problem ? "남은 공부일이 없어요" : `할 일 ${plan.tasks.length}개로 다시 짰어요`);
  }

  async function onDelete() {
    if (!(await askConfirm("시험 계획을 지울까요? 끝낸 기록은 남고, 남은 할 일은 지워져요.", { danger: true, confirmLabel: "지우기" }))) return;
    await deleteExam(id);
    router.replace("/planner");
  }

  return (
    <div className="space-y-5">
      <PageHeader title={exam.title} back="/planner" />
      <Card className="space-y-3 text-center">
        <p className="font-display text-4xl text-danger">{dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : "시험 끝"}</p>
        <p className="text-sm text-ink-soft">{formatDateKey(exam.date)}</p>
        <ProgressBar value={main.length ? done / main.length : 0} color="var(--accent)" label="전체 진행률" />
        <p className="text-sm">
          할 일 {done} / {main.length} 완료
        </p>
      </Card>

      <ExamResults exam={exam} subjectMap={subjectMap} dday={dday} />

      <section>
        <SectionTitle>과목별 단원 진도</SectionTitle>
        <Card className="space-y-3">
          {exam.ranges.map((r) => {
            const subject = subjectMap.get(r.subjectId);
            const doneUnits = new Set(tasks.filter((t) => t.kind === "learn" && t.done && t.subjectId === r.subjectId).map((t) => t.unit));
            const n = r.units.filter((u) => doneUnits.has(u)).length;
            return (
              <div key={r.subjectId} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-display">{subject?.name ?? "과목"}</span>
                  <span className="text-ink-soft">
                    {n}/{r.units.length} 단원
                  </span>
                </div>
                <ProgressBar value={r.units.length ? n / r.units.length : 0} color={subject?.color} label={`${subject?.name} 진도`} />
              </div>
            );
          })}
        </Card>
      </section>

      {lateCount > 0 && dday > 0 && (
        <Card className="flex items-center gap-3 border-xp bg-xp/10">
          <span aria-hidden className="text-2xl">
            ⚠️
          </span>
          <p className="flex-1 text-sm">밀린 할 일이 {lateCount}개 있어요. 남은 날에 맞춰 계획을 다시 짜 보세요.</p>
          <Button size="sm" onClick={onReplan}>
            다시 짜기
          </Button>
        </Card>
      )}

      <section>
        <SectionTitle>남은 일정</SectionTitle>
        {byDate.size === 0 ? (
          <Card>
            <Empty icon="🎉">남은 할 일이 없어요!</Empty>
          </Card>
        ) : (
          <div className="space-y-4">
            {[...byDate.entries()].map(([date, ts]) => (
              <div key={date}>
                <p className="font-display mb-1.5 text-sm text-ink-soft">{date === today ? "오늘" : formatDateKey(date)}</p>
                <ul className="space-y-2">
                  {ts.map((t) => (
                    <TaskRow key={t.id} task={t} subject={t.subjectId ? subjectMap.get(t.subjectId) : undefined} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => setEditing(true)}>
          ✏️ 시험 고치기
        </Button>
        <Button variant="ghost" onClick={onReplan} disabled={dday <= 0}>
          🔄 계획 다시 짜기
        </Button>
      </div>
      <Button variant="ghost" className="w-full text-danger" onClick={onDelete}>
        🗑 시험 삭제
      </Button>
      <EditExamSheet exam={exam} open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}
