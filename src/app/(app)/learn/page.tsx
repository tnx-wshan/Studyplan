"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DailyGoalCard } from "@/components/learn/DailyGoalCard";
import { CoursePicker } from "@/components/learn/CoursePicker";
import { PageHeader, Sheet } from "@/components/kit";
import { useUiStyle } from "@/components/ThemeSync";
import { Card, ProgressBar, cn } from "@/components/ui";
import type { GradeId, SubjectGroup } from "@/data/curriculum";
import { courseName } from "@/lib/learn/names";
import { getDB } from "@/lib/db";
import { updateProfile } from "@/lib/db/profile";
import { useProfile } from "@/lib/hooks";
import { fetchCourses, fetchOutline } from "@/lib/learn/client";
import { unitStates, type UnitState } from "@/lib/learn/engine";
import { courseKey, type CourseInfo, type CourseOutline } from "@/lib/learn/types";

export default function LearnPage() {
  const profile = useProfile();
  const noir = useUiStyle() === "noir";
  const [courses, setCourses] = useState<CourseInfo[] | null>(null);
  // 어떤 코스의 학습 지도인지 함께 기억한다 (코스를 바꾸면 저절로 '불러오는 중'이 된다)
  const [loaded, setLoaded] = useState<{ key: string; outline?: CourseOutline; offline?: boolean; error?: string } | null>(null);
  const [picking, setPicking] = useState(false);

  const course = profile?.learnCourse;
  const key = course ? courseKey(course.grade, course.subject) : "";
  const done = useLiveQuery(async () => new Set((await getDB().learnProgress.where("courseKey").equals(key).toArray()).map((p) => p.id)), [key]);

  useEffect(() => {
    fetchCourses()
      .then((r) => setCourses(r.data.courses))
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    if (!course) return;
    let cancelled = false;
    const k = courseKey(course.grade, course.subject);
    fetchOutline(course.grade, course.subject)
      .then((r) => !cancelled && setLoaded({ key: k, outline: r.data, offline: r.offline }))
      .catch((e) => !cancelled && setLoaded({ key: k, error: e instanceof Error ? e.message : "학습 지도를 불러오지 못했어요." }));
    return () => {
      cancelled = true;
    };
  }, [course]);
  const current = loaded && loaded.key === key ? loaded : null;
  const outline = current?.outline ?? null;
  const offline = !!current?.offline;
  const error = current?.error ?? null;

  const choose = useCallback(async (grade: GradeId, subject: SubjectGroup) => {
    await updateProfile({ learnCourse: { grade, subject } });
    setPicking(false);
  }, []);

  if (!profile) return null;

  if (!course) {
    return (
      <div className="space-y-4">
        <PageHeader title="📘 학습" />
        <Card className="space-y-1">
          <p className="font-display text-lg">{noir ? "과정을 고른다." : "무엇을 배울까요?"}</p>
          <p className="text-sm text-ink-soft">학년과 과목을 고르면 짧은 유닛을 하나씩 이어서 배워요. 하루 5분이면 충분해요.</p>
        </Card>
        <CoursePicker courses={courses} defaultGrade={profile.grade} onPick={choose} />
      </div>
    );
  }

  const states = outline && done ? unitStates(outline, done) : null;
  const total = outline?.sections.reduce((s, x) => s + x.units.length, 0) ?? 0;
  const doneCount = outline && done ? outline.sections.reduce((s, x) => s + x.units.filter((u) => done.has(u.id)).length, 0) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="📘 학습"
        action={
          <button type="button" onClick={() => setPicking(true)} className="font-display rounded-full border-2 border-line bg-surface px-3 py-1 text-sm" aria-label={`코스 바꾸기 (지금: ${courseName(course.grade, course.subject)})`}>
            {courseName(course.grade, course.subject)} ▾
          </button>
        }
      />

      <DailyGoalCard />

      {offline && <p className="rounded-2xl bg-xp/10 p-3 text-sm">📴 인터넷에 연결되지 않아 저장해 둔 학습 지도를 보여줘요.</p>}
      {error && (
        <Card role="alert" className="border-danger text-sm text-danger">
          {error}
        </Card>
      )}

      {outline && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-display">{courseName(course.grade, course.subject)} 진도</span>
            <span className="text-ink-soft">
              {doneCount}/{total} 유닛
            </span>
          </div>
          <ProgressBar value={total ? doneCount / total : 0} label="코스 진도" color="var(--success)" />
        </Card>
      )}

      {outline && total === 0 && (
        <Card className="text-center text-sm text-ink-soft">
          이 코스는 아직 준비 중이에요. 다른 코스를 골라 보세요.
          <button type="button" className="mt-2 block w-full underline" onClick={() => setPicking(true)}>
            코스 바꾸기
          </button>
        </Card>
      )}

      {outline && states && (
        <ol className="space-y-6">
          {outline.sections.map((section, si) => {
            const sectionDone = section.units.filter((u) => done?.has(u.id)).length;
            return (
              <li key={section.id}>
                <div className={cn("mb-3 flex items-end justify-between gap-2 border-b-2 pb-2", sectionDone === section.units.length && section.units.length > 0 ? "border-success" : "border-line")}>
                  <div>
                    <p className="text-xs text-ink-soft">섹션 {si + 1}</p>
                    <h2 className="font-display text-lg">{section.title}</h2>
                    {section.description && <p className="text-xs text-ink-soft">{section.description}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-ink-soft">{section.units.length ? `${sectionDone}/${section.units.length}` : "준비 중"}</span>
                </div>
                {section.units.length === 0 ? (
                  <p className="text-center text-sm text-ink-soft">유닛을 준비하고 있어요.</p>
                ) : (
                  <ul className="space-y-3">
                    {section.units.map((u, ui) => (
                      <UnitNode key={u.id} unit={u} state={states.get(u.id) ?? "locked"} offset={PATH[ui % PATH.length]} noir={noir} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!outline && !error && <p className="text-center text-sm text-ink-soft">학습 지도를 불러오는 중…</p>}

      <Sheet open={picking} onClose={() => setPicking(false)} title="코스 고르기">
        <CoursePicker courses={courses} defaultGrade={course.grade} current={course} onPick={choose} />
      </Sheet>
    </div>
  );
}

/** 듀오링고처럼 길을 따라 좌우로 흔들리는 유닛 배치 */
const PATH = ["ml-0", "ml-10", "ml-16", "ml-10", "ml-0", "ml-6"];

const STATE_LABEL: Record<UnitState, string> = { done: "완료", current: "지금 할 유닛", open: "열림", locked: "잠김" };

function UnitNode({ unit, state, offset, noir }: { unit: CourseOutline["sections"][number]["units"][number]; state: UnitState; offset: string; noir: boolean }) {
  const icon = state === "done" ? "✓" : state === "locked" ? "🔒" : "★";
  const circle = cn(
    "flex size-14 shrink-0 items-center justify-center text-xl font-display border-2",
    noir ? "rounded-sm" : "rounded-full",
    state === "done" && "border-success bg-success text-white",
    state === "current" && "border-primary bg-primary text-white shadow-[0_4px_0_var(--primary-shadow)] animate-pulse",
    state === "open" && "border-accent bg-surface text-accent-deep",
    state === "locked" && "border-line bg-surface-2 text-ink-soft",
  );
  const body = (
    <>
      <span aria-hidden className={circle}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn("font-display block truncate", state === "locked" && "text-ink-soft")}>{unit.title}</span>
        <span className="block text-xs text-ink-soft">
          {state === "current" ? (noir ? "다음 임무" : "지금 할 차례예요") : STATE_LABEL[state]} · 약 {unit.minutes}분 · 문제 {unit.questionCount}개
        </span>
      </span>
    </>
  );
  return (
    <li className={cn("max-w-[calc(100%-4rem)]", offset)}>
      {state === "locked" ? (
        <button type="button" disabled className="flex w-full items-center gap-3 text-left" aria-label={`${unit.title} (잠김: 앞 유닛을 먼저 끝내세요)`}>
          {body}
        </button>
      ) : (
        <Link href={`/learn/lesson?unit=${unit.id}`} className="flex items-center gap-3" aria-label={`${unit.title} (${STATE_LABEL[state]})`}>
          {body}
        </Link>
      )}
    </li>
  );
}
