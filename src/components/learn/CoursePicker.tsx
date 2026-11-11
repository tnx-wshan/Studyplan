"use client";

import { useState } from "react";
import { GRADES, SUBJECT_GROUPS, type GradeId, type SubjectGroup } from "@/data/curriculum";
import { gradeShort } from "@/lib/learn/names";
import type { CourseInfo } from "@/lib/learn/types";
import { cn } from "../ui";

/**
 * 듀오링고에서 배울 언어를 고르듯 학년과 과목을 고른다.
 * 유닛이 있는 코스에는 유닛 수를, 없는 코스에는 '준비 중'을 보여준다.
 */
export function CoursePicker({
  courses,
  defaultGrade,
  current,
  onPick,
}: {
  courses: CourseInfo[] | null;
  defaultGrade: GradeId;
  current?: { grade: GradeId; subject: SubjectGroup };
  onPick: (grade: GradeId, subject: SubjectGroup) => void;
}) {
  const [grade, setGrade] = useState<GradeId>(current?.grade ?? defaultGrade);
  const count = (g: GradeId, s?: SubjectGroup) => (courses ?? []).filter((c) => c.grade === g && (!s || c.subject === s)).reduce((n, c) => n + c.units, 0);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm text-ink-soft">학년</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="학년">
          {GRADES.map((g) => {
            const n = count(g.id);
            return (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={grade === g.id}
                onClick={() => setGrade(g.id)}
                className={cn("rounded-2xl border-2 px-2 py-2 text-center", grade === g.id ? "border-accent bg-accent/10" : "border-line bg-surface")}
              >
                <span className="font-display block">{gradeShort(g.id)}</span>
                <span className="block text-[11px] text-ink-soft">{n ? `유닛 ${n}개` : "준비 중"}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-sm text-ink-soft">과목</p>
        <ul className="space-y-2">
          {SUBJECT_GROUPS.map((s) => {
            const n = count(grade, s.id);
            const active = current?.grade === grade && current.subject === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={n === 0}
                  onClick={() => onPick(grade, s.id)}
                  aria-label={`${gradeShort(grade)} ${s.label} ${n ? `유닛 ${n}개` : "준비 중"}`}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border-2 bg-surface p-3 text-left disabled:opacity-50",
                    active ? "border-accent" : "border-line",
                  )}
                >
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-xl font-display text-white" style={{ background: s.color }}>
                    {s.short}
                  </span>
                  <span className="flex-1">
                    <span className="font-display block">
                      {gradeShort(grade)} {s.label}
                    </span>
                    <span className="block text-xs text-ink-soft">{n ? `유닛 ${n}개` : "준비 중이에요"}</span>
                  </span>
                  {active && <span className="text-xs text-accent-deep">지금 코스</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {courses === null && <p className="mt-2 text-center text-xs text-ink-soft">코스 목록을 불러오는 중…</p>}
      </div>
    </div>
  );
}
