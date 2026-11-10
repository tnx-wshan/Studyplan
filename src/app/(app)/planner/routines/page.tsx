"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { DOW, Empty, Field, PageHeader, Sheet, SubjectChip, SubjectPicker, TextInput, useSubjectMap, useSubjects } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { Button, Card, cn } from "@/components/ui";
import { getDB } from "@/lib/db";
import { addRoutine, deleteRoutine, routinesForReminders, updateRoutine, type RoutineInput } from "@/lib/db/routines";
import type { Routine } from "@/lib/db/types";
import { readPushState, syncRoutineReminders } from "@/lib/push/client";

const PRESETS: { label: string; days: number[] }[] = [
  { label: "평일", days: [1, 2, 3, 4, 5] },
  { label: "매일", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "주말", days: [0, 6] },
];
const MINUTES = [10, 20, 30, 45, 60, 90];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // 월요일부터

function daysLabel(days: number[]) {
  const sorted = ORDER.filter((d) => days.includes(d));
  const preset = PRESETS.find((p) => p.days.length === sorted.length && p.days.every((d) => days.includes(d)));
  return preset ? preset.label : sorted.map((d) => DOW[d]).join("·");
}

async function syncReminders() {
  await syncRoutineReminders(await routinesForReminders());
}

export default function RoutinesPage() {
  const subjectMap = useSubjectMap();
  const routines = useLiveQuery(async () => (await getDB().routines.toArray()).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || a.createdAt - b.createdAt), []);
  const [editing, setEditing] = useState<Routine | "new" | null>(null);
  if (!routines) return null;
  const pushOn = typeof window !== "undefined" && readPushState().enabled;

  return (
    <div className="space-y-4">
      <PageHeader
        title="🔁 고정 루틴"
        back="/planner"
        action={
          <Button size="sm" onClick={() => setEditing("new")}>
            + 루틴
          </Button>
        }
      />
      <p className="text-sm text-ink-soft">
        “평일 저녁 8시 수학 30분”처럼 정해 두면 플래너에 매주 자동으로 들어가요. 언제 무엇을 할지 미리 정해 두면 실천하기 훨씬 쉬워요.
        {!pushOn && " 설정에서 알림을 켜면 시작 시각에 알려 줘요."}
      </p>

      {routines.length === 0 ? (
        <Card>
          <Empty icon="🔁">
            아직 루틴이 없어요.
            <br />
            작게 시작해 보세요. 예: 평일 저녁 영단어 10분
          </Empty>
        </Card>
      ) : (
        <ul className="space-y-2">
          {routines.map((r) => (
            <li key={r.id}>
              <Card className={cn("flex items-center gap-3 p-3", !r.active && "opacity-60")}>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(r)}>
                  <span className="flex items-center gap-2">
                    {r.time && <span className="font-display tabular-nums">{r.time}</span>}
                    <span className="truncate">{r.title}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                    <SubjectChip subject={r.subjectId ? subjectMap.get(r.subjectId) : undefined} />
                    {daysLabel(r.days)} · {r.minutes}분{!r.active && " · 쉬는 중"}
                  </span>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.active}
                  aria-label={`${r.title} 켜기`}
                  onClick={async () => {
                    await updateRoutine(r.id, { active: !r.active });
                    await syncReminders();
                    toast(r.active ? "루틴을 쉬어요. 앞으로의 할 일을 뺐어요." : "루틴을 다시 시작해요");
                  }}
                  className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", r.active ? "bg-success" : "bg-line")}
                >
                  <span className={cn("absolute top-1 size-5 rounded-full bg-white transition-all", r.active ? "left-6" : "left-1")} />
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "새 루틴" : "루틴 고치기"}>
        {editing && <RoutineForm key={editing === "new" ? "new" : editing.id} routine={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function RoutineForm({ routine, onDone }: { routine: Routine | null; onDone: () => void }) {
  const subjects = useSubjects() ?? [];
  const [title, setTitle] = useState(routine?.title ?? "");
  const [subjectId, setSubjectId] = useState(routine?.subjectId);
  const [days, setDays] = useState<number[]>(routine?.days ?? [1, 2, 3, 4, 5]);
  const [time, setTime] = useState(routine?.time ?? "20:00");
  const [useTime, setUseTime] = useState(routine ? !!routine.time : true);
  const [minutes, setMinutes] = useState(routine?.minutes ?? 30);
  const valid = title.trim() && days.length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const input: RoutineInput = { title, subjectId, days, minutes, time: useTime && time ? time : undefined };
    if (routine) await updateRoutine(routine.id, input);
    else await addRoutine(input);
    await syncReminders();
    toast(routine ? "루틴을 고쳤어요. 앞으로의 할 일에 반영했어요." : "루틴을 만들었어요. 플래너에 넣었어요!");
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="무엇을 할까요?">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 수학 문제집 3쪽" maxLength={40} autoFocus />
      </Field>
      <div>
        <p className="mb-1.5 text-sm text-ink-soft">과목</p>
        <SubjectPicker subjects={subjects} value={subjectId} onChange={setSubjectId} allowNone />
      </div>
      <div>
        <p className="mb-1.5 text-sm text-ink-soft">요일</p>
        <div className="mb-2 flex gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => setDays(p.days)} className="rounded-full border-2 border-line bg-surface-2 px-3 py-1 text-sm">
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {ORDER.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days.includes(d)}
              aria-label={`${DOW[d]}요일`}
              onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
              className={cn("font-display rounded-xl border-2 py-1.5 text-sm", days.includes(d) ? "border-primary bg-primary text-white" : "border-line")}
            >
              {DOW[d]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex flex-1 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={useTime} onChange={(e) => setUseTime(e.target.checked)} />
          시작 시각 정하기
        </label>
        <input type="time" aria-label="시작 시각" value={time} disabled={!useTime} onChange={(e) => setTime(e.target.value)} className="rounded-xl border-2 border-line bg-surface px-2 py-1.5 disabled:opacity-40" />
      </div>
      <div>
        <p className="mb-1.5 text-sm text-ink-soft">시간</p>
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
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={!valid}>
          {routine ? "저장" : "루틴 만들기"}
        </Button>
        {routine && (
          <Button
            type="button"
            variant="ghost"
            className="text-danger"
            onClick={async () => {
              if (!confirm("이 루틴을 지울까요? 앞으로의 할 일도 함께 지워져요. 끝낸 기록은 남아요.")) return;
              await deleteRoutine(routine.id);
              await syncReminders();
              onDone();
            }}
          >
            삭제
          </Button>
        )}
      </div>
    </form>
  );
}
