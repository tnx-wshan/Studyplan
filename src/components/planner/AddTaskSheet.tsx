"use client";

import { useState, type FormEvent } from "react";
import { Field, Select, Sheet, SubjectPicker, TextInput, formatDateKey, useSubjects } from "@/components/kit";
import { Button, cn } from "@/components/ui";
import { unitsForSubject } from "@/data/curriculum";
import { addTask } from "@/lib/db/study";

const MINUTES = [15, 30, 45, 60, 90];

export function AddTaskSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const subjects = useSubjects() ?? [];
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState<string>();
  const [unit, setUnit] = useState("");
  const [minutes, setMinutes] = useState<number>(30);
  const subject = subjects.find((s) => s.id === subjectId);
  const units = subject ? unitsForSubject(subject) : [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const finalTitle = title.trim() || unit;
    if (!finalTitle) return;
    await addTask({ date, title: finalTitle, subjectId, unit: unit || undefined, estimatedMinutes: minutes });
    setTitle("");
    setUnit("");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`${formatDateKey(date)} 할 일 추가`}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <p className="mb-1.5 text-sm text-ink-soft">과목</p>
          <SubjectPicker
            subjects={subjects}
            value={subjectId}
            onChange={(id) => {
              setSubjectId(id);
              setUnit("");
            }}
            allowNone
          />
        </div>
        {units.length > 0 && (
          <Field label="단원 (선택)" hint="단원을 고르면 끝낸 뒤 1·3·7·14일 뒤 복습 할 일이 자동으로 생겨요.">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="">선택 안 함</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="할 일">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={unit || "예: 수학 익힘책 30~35쪽"} maxLength={60} autoFocus />
        </Field>
        <div>
          <p className="mb-1.5 text-sm text-ink-soft">예상 시간</p>
          <div className="flex flex-wrap gap-2">
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => setMinutes(m)}
                className={cn("font-display rounded-full border-2 px-3 py-1 text-sm", minutes === m ? "border-primary bg-primary text-white" : "border-line")}
              >
                {m}분
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={!title.trim() && !unit}>
          추가하기
        </Button>
      </form>
    </Sheet>
  );
}
