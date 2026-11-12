"use client";

import { XP_REWARDS } from "@/lib/game/level";
import Link from "next/link";
import { useState } from "react";
import { Field, Sheet, SubjectChip, TextInput } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { Button, cn } from "@/components/ui";
import { addDays } from "@/lib/date";
import { deleteTask, setTaskDone, updateTask } from "@/lib/db/study";
import type { Subject, Task } from "@/lib/db/types";
import { askConfirm } from "@/components/Dialogs";

const KIND_BADGE: Partial<Record<Task["kind"], { label: string; className: string }>> = {
  review: { label: "범위 복습", className: "bg-accent/15 text-accent-deep" },
  final: { label: "총정리", className: "bg-danger/15 text-danger" },
  spaced: { label: "간격 복습", className: "bg-success/15 text-success-deep" },
};

export function TaskRow({ task, subject }: { task: Task; subject?: Subject }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const badge = KIND_BADGE[task.kind];

  async function toggle() {
    const first = !task.done && !task.xpGranted;
    await setTaskDone(task.id, !task.done);
    if (first) toast(task.unit && (task.kind === "learn" || task.kind === "custom") ? `+${XP_REWARDS.taskDone} XP · 복습 일정도 만들었어요!` : "+10 XP");
  }

  return (
    <li className={cn("rounded-2xl bg-surface-2 p-3 transition-opacity", task.done && "opacity-60")}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={task.done}
          aria-label={`${task.title} 완료`}
          onClick={toggle}
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-[3px] text-sm text-white transition-colors",
            task.done ? "border-success bg-success" : "border-line bg-surface",
          )}
        >
          {task.done && "✓"}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("break-words", task.done && "line-through")}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
            <SubjectChip subject={subject} />
            {task.time && <span className="font-display tabular-nums text-ink">{task.time}</span>}
            {task.routineId && <span className="font-display rounded-full bg-surface px-2 py-0.5">🔁 루틴</span>}
            {badge && <span className={cn("font-display rounded-full px-2 py-0.5", badge.className)}>{badge.label}</span>}
            {task.estimatedMinutes ? <span>약 {task.estimatedMinutes}분</span> : null}
            {task.actualMinutes ? <span className="text-success-deep">실제 {task.actualMinutes}분</span> : null}
          </div>
        </div>
        {!task.done && (
          <Link href={`/timer?task=${task.id}`} aria-label={`${task.title} 타이머 시작`} className="rounded-full px-1.5 text-xl">
            ⏱️
          </Link>
        )}
        <button type="button" aria-label="더보기" aria-expanded={menu} onClick={() => setMenu(!menu)} className="rounded-full px-1.5 text-xl text-ink-soft">
          ⋯
        </button>
      </div>
      {menu && (
        <div className="mt-2 flex flex-wrap justify-end gap-2 text-sm">
          <button type="button" className="font-display rounded-full border-2 border-line px-3 py-1" onClick={() => setEditing(true)}>
            고치기
          </button>
          {!task.done && (
            <button type="button" className="font-display rounded-full border-2 border-line px-3 py-1" onClick={() => updateTask(task.id, { date: addDays(task.date, 1) })}>
              내일로 미루기
            </button>
          )}
          <button
            type="button"
            className="font-display rounded-full border-2 border-danger px-3 py-1 text-danger"
            onClick={async () => (await askConfirm("이 할 일을 지울까요?", { danger: true, confirmLabel: "지우기" })) && deleteTask(task.id)}
          >
            삭제
          </button>
        </div>
      )}
      <Sheet open={editing} onClose={() => setEditing(false)} title="할 일 고치기">
        {editing && <EditTaskForm task={task} onDone={() => setEditing(false)} />}
      </Sheet>
    </li>
  );
}

function EditTaskForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date);
  const [minutes, setMinutes] = useState(String(task.estimatedMinutes ?? ""));
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const m = Number(minutes);
        await updateTask(task.id, { title: title.trim(), date, estimatedMinutes: minutes.trim() && Number.isFinite(m) && m > 0 ? Math.round(m) : undefined });
        onDone();
      }}
    >
      <Field label="할 일">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="날짜">
          <TextInput type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <Field label="예상 시간(분)">
          <TextInput type="number" inputMode="numeric" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
      </div>
      <Button type="submit" className="w-full" disabled={!title.trim()}>
        저장
      </Button>
    </form>
  );
}
