"use client";

import Link from "next/link";
import { useState } from "react";
import { SubjectChip } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { cn } from "@/components/ui";
import { addDays } from "@/lib/date";
import { deleteTask, setTaskDone, updateTask } from "@/lib/db/study";
import type { Subject, Task } from "@/lib/db/types";

const KIND_BADGE: Partial<Record<Task["kind"], { label: string; className: string }>> = {
  review: { label: "범위 복습", className: "bg-accent/15 text-accent-deep" },
  final: { label: "총정리", className: "bg-danger/15 text-danger" },
  spaced: { label: "간격 복습", className: "bg-success/15 text-success-deep" },
};

export function TaskRow({ task, subject }: { task: Task; subject?: Subject }) {
  const [menu, setMenu] = useState(false);
  const badge = KIND_BADGE[task.kind];

  async function toggle() {
    const first = !task.done && !task.xpGranted;
    await setTaskDone(task.id, !task.done);
    if (first) toast(task.unit && (task.kind === "learn" || task.kind === "custom") ? "+10 XP · 복습 일정도 만들었어요!" : "+10 XP");
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
            {badge && <span className={cn("font-display rounded-full px-2 py-0.5", badge.className)}>{badge.label}</span>}
            {task.estimatedMinutes ? <span>약 {task.estimatedMinutes}분</span> : null}
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
          {!task.done && (
            <button type="button" className="font-display rounded-full border-2 border-line px-3 py-1" onClick={() => updateTask(task.id, { date: addDays(task.date, 1) })}>
              내일로 미루기
            </button>
          )}
          <button
            type="button"
            className="font-display rounded-full border-2 border-danger px-3 py-1 text-danger"
            onClick={() => confirm("이 할 일을 지울까요?") && deleteTask(task.id)}
          >
            삭제
          </button>
        </div>
      )}
    </li>
  );
}
