"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { Field, PageHeader, Sheet, TextInput, compareSubjects } from "@/components/kit";
import { Button, Card, cn } from "@/components/ui";
import { SUBJECT_GROUPS, coursesFor, gradeLabel, unitsForSubject, type SubjectGroup } from "@/data/curriculum";
import { getDB } from "@/lib/db";
import { addSubject, updateSubject } from "@/lib/db/study";
import type { Subject } from "@/lib/db/types";
import { useProfile } from "@/lib/hooks";
import { askText } from "@/components/Dialogs";

const COLORS = ["#ef6b6b", "#5b8def", "#d4881c", "#47b881", "#9b6bdf", "#e86bb5", "#3fb5c9", "#8d7b68"];

export default function SubjectsPage() {
  const profile = useProfile();
  const subjects = useLiveQuery(async () => (await getDB().subjects.toArray()).sort((a, b) => Number(!!a.archived) - Number(!!b.archived) || compareSubjects(a, b)), []);
  const [adding, setAdding] = useState(false);
  if (!profile || !subjects) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="과목 관리"
        back="/settings"
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            + 과목
          </Button>
        }
      />
      <p className="text-sm text-ink-soft">
        {gradeLabel(profile.grade)} 교육과정 과목을 연결하면 그 단원들이 플래너, 시험 범위, 오답노트에 나와요. 교과서 단원이 다르면 직접 추가하세요.
      </p>
      <ul className="space-y-2">
        {subjects.map((s) => (
          <SubjectEditor key={s.id} subject={s} grade={profile.grade} />
        ))}
      </ul>
      <AddSubjectSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function SubjectEditor({ subject, grade }: { subject: Subject; grade: Parameters<typeof coursesFor>[0] }) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState("");
  const courses = coursesFor(grade, subject.group);
  const units = unitsForSubject(subject);

  function toggleCourse(id: string, on: boolean) {
    void updateSubject(subject.id, { courseIds: on ? [...subject.courseIds, id] : subject.courseIds.filter((x) => x !== id) });
  }
  function addUnit(e: FormEvent) {
    e.preventDefault();
    const u = unit.trim();
    if (!u || units.includes(u)) return setUnit("");
    void updateSubject(subject.id, { customUnits: [...subject.customUnits, u] });
    setUnit("");
  }

  return (
    <li>
      <Card className={cn("p-3", subject.archived && "opacity-60")}>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left">
          <span className="inline-block size-4 rounded-full" style={{ background: subject.color }} />
          <span className="font-display flex-1">
            {subject.name}
            {subject.archived && <span className="ml-1 text-xs text-ink-soft">(숨김)</span>}
          </span>
          <span className="text-sm text-ink-soft">단원 {units.length}개</span>
          <span aria-hidden className="text-ink-soft">
            {open ? "▲" : "▼"}
          </span>
        </button>
        {open && (
          <div className="mt-3 space-y-4">
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`색 ${c}`}
                  aria-pressed={subject.color === c}
                  onClick={() => updateSubject(subject.id, { color: c })}
                  className={cn("size-8 rounded-full border-4", subject.color === c ? "border-ink" : "border-transparent")}
                  style={{ background: c }}
                />
              ))}
            </div>

            {courses.length > 0 && (
              <div>
                <p className="mb-1 text-sm text-ink-soft">교육과정 과목 연결</p>
                <ul className="space-y-1">
                  {courses.map((c) => (
                    <li key={c.id}>
                      <label className="flex items-start gap-2 py-1">
                        <input type="checkbox" className="mt-0.5 size-5 accent-[var(--primary)]" checked={subject.courseIds.includes(c.id)} onChange={(e) => toggleCourse(c.id, e.target.checked)} />
                        <span className="text-sm">
                          <span className="font-display">{c.name}</span>
                          <span className="block text-xs text-ink-soft">{c.units.length ? c.units.join(" · ") : "단원 정보 없음: 아래에 직접 추가"}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-1 text-sm text-ink-soft">직접 추가한 단원</p>
              {subject.customUnits.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {subject.customUnits.map((u) => (
                    <li key={u} className="flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-3 pr-1 text-sm">
                      {u}
                      <button
                        type="button"
                        aria-label={`${u} 삭제`}
                        className="rounded-full px-1.5 text-ink-soft"
                        onClick={() => updateSubject(subject.id, { customUnits: subject.customUnits.filter((x) => x !== u) })}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={addUnit} className="flex gap-2">
                <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="예: 3. 빛과 파동" maxLength={40} />
                <Button type="submit" size="sm" variant="ghost">
                  추가
                </Button>
              </form>
            </div>

            <div className="flex justify-between gap-2">
              <button
                type="button"
                className="text-sm underline"
                onClick={async () => {
                  const name = await askText("과목 이름", { value: subject.name });
                  if (name?.trim()) void updateSubject(subject.id, { name: name.trim() });
                }}
              >
                이름 변경
              </button>
              <button type="button" className="text-sm text-ink-soft underline" onClick={() => updateSubject(subject.id, { archived: !subject.archived })}>
                {subject.archived ? "다시 보이기" : "목록에서 숨기기"}
              </button>
            </div>
          </div>
        )}
      </Card>
    </li>
  );
}

function AddSubjectSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState<SubjectGroup>("social");
  const [color, setColor] = useState(COLORS[5]);
  return (
    <Sheet open={open} onClose={onClose} title="과목 추가">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await addSubject({ name, group, color });
          setName("");
          onClose();
        }}
      >
        <Field label="과목 이름">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 한국사" maxLength={20} autoFocus />
        </Field>
        <div>
          <p className="mb-1.5 text-sm text-ink-soft">분류</p>
          <div className="flex flex-wrap gap-1.5">
            {SUBJECT_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={group === g.id}
                onClick={() => setGroup(g.id)}
                className={cn("font-display rounded-full border-2 px-3 py-1 text-sm", group === g.id ? "border-ink bg-ink text-bg" : "border-line")}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" aria-label={`색 ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={cn("size-8 rounded-full border-4", color === c ? "border-ink" : "border-transparent")} style={{ background: c }} />
          ))}
        </div>
        <Button type="submit" className="w-full" disabled={!name.trim()}>
          추가하기
        </Button>
      </form>
    </Sheet>
  );
}
