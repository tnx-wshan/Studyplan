"use client";

import { useState } from "react";
import { Field, Sheet, TextInput } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { Button, cn } from "@/components/ui";
import { addDays, toDateKey } from "@/lib/date";
import { updateExam } from "@/lib/db/study";
import type { Exam } from "@/lib/db/types";

const MINUTES = [30, 60, 90, 120, 180, 240];
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** 시험 이름·날짜·공부 시간·쉬는 요일 고치기 (날짜나 시간이 바뀌면 남은 계획을 다시 짠다) */
export function EditExamSheet({ exam, open, onClose }: { exam: Exam; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="시험 고치기">
      {open && <EditExamForm exam={exam} onDone={onClose} />}
    </Sheet>
  );
}

function EditExamForm({ exam, onDone }: { exam: Exam; onDone: () => void }) {
  const [title, setTitle] = useState(exam.title);
  const [date, setDate] = useState(exam.date);
  const [minutes, setMinutes] = useState(exam.minutesPerDay);
  const [rest, setRest] = useState<number[]>(exam.restDays);
  const today = toDateKey();
  const upcoming = exam.date > today;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || !date) return;
        const r = await updateExam(exam.id, { title, date, minutesPerDay: minutes, restDays: rest }, today);
        if (r.replanned) toast(r.plan.problem ? "시험 전까지 공부할 수 있는 날이 없어요. 날짜나 쉬는 요일을 확인해 주세요" : `남은 계획을 할 일 ${r.plan.tasks.length}개로 다시 짰어요`);
        else toast("시험 정보를 고쳤어요");
        onDone();
      }}
    >
      <Field label="시험 이름">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} autoFocus />
      </Field>
      <Field label="시험 날짜">
        <TextInput type="date" value={date} min={upcoming ? addDays(today, 1) : undefined} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </Field>
      {upcoming && (
        <>
          <div>
            <p className="mb-1.5 text-sm text-ink-soft">하루 공부 시간</p>
            <div className="flex flex-wrap gap-2">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutes === m}
                  onClick={() => setMinutes(m)}
                  className={cn("font-display rounded-full border-2 px-3 py-1 text-sm", minutes === m ? "border-primary bg-primary text-white" : "border-line")}
                >
                  {m < 60 ? `${m}분` : `${m / 60}시간`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm text-ink-soft">쉬는 요일</p>
            <div className="grid grid-cols-7 gap-1">
              {DOW.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={rest.includes(i)}
                  onClick={() => setRest(rest.includes(i) ? rest.filter((x) => x !== i) : [...rest, i])}
                  className={cn("font-display rounded-xl border-2 py-1.5 text-sm", rest.includes(i) ? "border-ink-soft bg-ink-soft text-bg" : "border-line")}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-soft">날짜·시간·요일을 바꾸면 끝내지 않은 할 일을 오늘부터 다시 짜요. 끝낸 기록과 간격 복습은 그대로예요.</p>
        </>
      )}
      <Button type="submit" className="w-full" disabled={!title.trim() || !date}>
        저장
      </Button>
    </form>
  );
}
