"use client";

import { useState } from "react";
import { GRADES, SUBJECT_GROUPS, type GradeId } from "@/data/curriculum";
import { gradeShort } from "@/lib/learn/names";
import type { CourseInfo, LearnSubject } from "@/lib/learn/types";
import { cn } from "../ui";

/** 서버가 과목 목록을 아직 주지 않았을 때(오프라인 등) 쓰는 기본 5과목 */
function fallbackSubjects(grade: GradeId, courses: CourseInfo[] | null): LearnSubject[] {
  return SUBJECT_GROUPS.map((g) => ({
    key: g.id,
    grade,
    name: g.label,
    short: g.short,
    color: g.color,
    group: g.id,
    builtIn: true,
    units: (courses ?? []).find((c) => c.grade === grade && c.subject === g.id)?.units ?? 0,
  }));
}

/**
 * 듀오링고에서 배울 언어를 고르듯 학년과 과목을 고른다.
 * 과목은 기본 5과목과 관리자가 학년마다 추가한 과목(수학2, 역사 …). 유닛이 없으면 '준비 중'.
 */
export function CoursePicker({
  courses,
  subjects,
  defaultGrade,
  current,
  onPick,
}: {
  courses: CourseInfo[] | null;
  subjects: Partial<Record<GradeId, LearnSubject[]>> | null;
  defaultGrade: GradeId;
  current?: { grade: GradeId; subject: string };
  onPick: (grade: GradeId, subject: string) => void;
}) {
  const [grade, setGrade] = useState<GradeId>(current?.grade ?? defaultGrade);
  const listFor = (g: GradeId) => subjects?.[g] ?? fallbackSubjects(g, courses);
  const count = (g: GradeId) => listFor(g).reduce((n, s) => n + s.units, 0);

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
          {listFor(grade).map((s) => {
            const active = current?.grade === grade && current.subject === s.key;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={s.units === 0}
                  onClick={() => onPick(grade, s.key)}
                  aria-label={`${gradeShort(grade)} ${s.name} ${s.units ? `유닛 ${s.units}개` : "준비 중"}`}
                  className={cn("flex w-full items-center gap-3 rounded-2xl border-2 bg-surface p-3 text-left disabled:opacity-50", active ? "border-accent" : "border-line")}
                >
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-xl font-display text-white" style={{ background: s.color }}>
                    {s.short}
                  </span>
                  <span className="flex-1">
                    <span className="font-display block">
                      {gradeShort(grade)} {s.name}
                    </span>
                    <span className="block text-xs text-ink-soft">{s.units ? `유닛 ${s.units}개` : "준비 중이에요"}</span>
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
