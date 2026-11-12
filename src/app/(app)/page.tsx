"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CoursePicker } from "@/components/learn/CoursePicker";
import { SectionPath } from "@/components/learn/LearnPath";
import { Sheet } from "@/components/kit";
import { Pet } from "@/components/Pet";
import { useUiStyle } from "@/components/ThemeSync";
import { Card, ProgressBar, buttonStyles, cn } from "@/components/ui";
import { SUBJECT_GROUPS, type GradeId, type SubjectGroup } from "@/data/curriculum";
import { getDB } from "@/lib/db";
import { dailyLearn } from "@/lib/db/learn";
import { updateProfile } from "@/lib/db/profile";
import { toDateKey } from "@/lib/date";
import { usePetState, useProfile } from "@/lib/hooks";
import { fetchCourses, fetchOutline } from "@/lib/learn/client";
import { nextUnitId, unitStates } from "@/lib/learn/engine";
import { courseName } from "@/lib/learn/names";
import { courseKey, type CourseInfo, type CourseOutline } from "@/lib/learn/types";

/**
 * 첫 화면: 학습. 듀오링고·토도수학처럼 코스의 길을 따라 유닛을 하나씩 깬다.
 * 위쪽 '오늘의 미션'에서 바로 이어서 하고, 아래 길에서 지난 유닛을 다시 하거나 진도를 본다.
 */
export default function LearnHomePage() {
  const profile = useProfile();
  const noir = useUiStyle() === "noir";
  const [courses, setCourses] = useState<CourseInfo[] | null>(null);
  // 어떤 코스의 학습 지도인지 함께 기억한다 (코스를 바꾸면 저절로 '불러오는 중'이 된다)
  const [loaded, setLoaded] = useState<{ key: string; outline?: CourseOutline; offline?: boolean; error?: string } | null>(null);
  const [picking, setPicking] = useState(false);

  const course = profile?.learnCourse;
  const key = course ? courseKey(course.grade, course.subject) : "";
  const progress = useLiveQuery(async () => {
    const rows = await getDB().learnProgress.where("courseKey").equals(key).toArray();
    return new Map(rows.map((p) => [p.id, { bestCorrect: p.bestCorrect, total: p.total }]));
  }, [key]);

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
  const error = current?.error ?? null;

  const choose = useCallback(async (grade: GradeId, subject: SubjectGroup) => {
    await updateProfile({ learnCourse: { grade, subject } });
    setPicking(false);
  }, []);

  if (!profile) return null;

  if (!course) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">📘 학습</h1>
        <Card className="space-y-1">
          <p className="font-display text-lg">{noir ? "과정을 고른다." : "무엇을 배울까요?"}</p>
          <p className="text-sm text-ink-soft">학년과 과목을 고르면 짧은 유닛을 하나씩 이어서 배워요. 하루 5분이면 충분해요.</p>
        </Card>
        <CoursePicker courses={courses} defaultGrade={profile.grade} onPick={choose} />
      </div>
    );
  }

  const done = progress ? new Set(progress.keys()) : null;
  const states = outline && done ? unitStates(outline, done) : null;
  const total = outline?.sections.reduce((s, x) => s + x.units.length, 0) ?? 0;
  const doneCount = outline && done ? outline.sections.reduce((s, x) => s + x.units.filter((u) => done.has(u.id)).length, 0) : 0;
  const nextId = outline && done ? nextUnitId(outline, done) : undefined;
  const next = nextId ? outline?.sections.flatMap((s) => s.units.map((u) => ({ unit: u, section: s.title }))).find((x) => x.unit.id === nextId) : undefined;
  const group = SUBJECT_GROUPS.find((g) => g.id === course.subject);

  return (
    <div className="space-y-5">
      <h1 className="sr-only">학습</h1>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className={cn("font-display flex items-center gap-2 border-2 border-line bg-surface py-1 pl-1 pr-3 text-sm", noir ? "rounded-sm" : "rounded-full")}
          aria-label={`코스 바꾸기 (지금: ${courseName(course.grade, course.subject)})`}
        >
          <span aria-hidden className={cn("flex size-7 items-center justify-center text-xs text-white", noir ? "rounded-sm" : "rounded-full")} style={{ background: group?.color }}>
            {group?.short}
          </span>
          {courseName(course.grade, course.subject)} ▾
        </button>
        <div className="ml-auto">
          <GoalRing />
        </div>
      </div>

      <MissionCard next={next} noir={noir} finished={!!outline && total > 0 && !nextId} />

      {current?.offline && <p className="rounded-2xl bg-xp/10 p-3 text-sm">📴 인터넷에 연결되지 않아 저장해 둔 학습 지도를 보여줘요.</p>}
      {error && (
        <Card role="alert" className="border-danger text-sm text-danger">
          {error}
        </Card>
      )}

      {outline && total > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>{courseName(course.grade, course.subject)} 진도</span>
            <span className="font-display">
              {doneCount}/{total} 유닛
            </span>
          </div>
          <ProgressBar value={doneCount / total} label="코스 진도" color="var(--success)" />
        </div>
      )}

      {outline && total === 0 && (
        <Card className="text-center text-sm text-ink-soft">
          이 코스는 아직 준비 중이에요. 다른 코스를 골라 보세요.
          <button type="button" className="mt-2 block w-full underline" onClick={() => setPicking(true)}>
            코스 바꾸기
          </button>
        </Card>
      )}

      {outline && states && progress && (
        <ol className="space-y-8 pb-4">
          {outline.sections.map((section, si) => (
            <SectionPath key={section.id} section={section} index={si} states={states} best={progress} noir={noir} />
          ))}
        </ol>
      )}

      {!outline && !error && <p className="text-center text-sm text-ink-soft">학습 지도를 불러오는 중…</p>}

      <Sheet open={picking} onClose={() => setPicking(false)} title="코스 고르기">
        <CoursePicker courses={courses} defaultGrade={course.grade} current={course} onPick={choose} />
      </Sheet>
    </div>
  );
}

/** 오늘의 미션: 동료가 다음 유닛을 알려주고, 단추 하나로 바로 시작한다 */
function MissionCard({ next, noir, finished }: { next?: { unit: CourseOutline["sections"][number]["units"][number]; section: string }; noir: boolean; finished: boolean }) {
  const pet = usePetState();
  const today = toDateKey();
  const d = useLiveQuery(() => dailyLearn(today), [today]);
  const met = d ? d.todaySeconds >= d.goalMinutes * 60 : false;
  const line = finished
    ? noir
      ? "이 과정은 끝까지 기록했다."
      : "코스를 모두 끝냈어요! 대단해요 🎉"
    : met
      ? noir
        ? "오늘의 몫은 끝났다. 더 가도 좋다."
        : "오늘 목표 달성! 하나 더 해 볼까요?"
      : noir
        ? "다음 기록을 열 시간이다."
        : "오늘도 한 걸음, 같이 가요!";
  return (
    <Card className="flex items-center gap-3">
      {pet && <Pet species={pet.profile.pet.species} stage={pet.stage.stage} mood={met ? "excited" : "happy"} size={84} accessory={pet.profile.equipped?.accessory} className="shrink-0" />}
      <div className="min-w-0 flex-1 space-y-2">
        <p className={cn("relative bg-surface-2 px-3 py-2 text-sm", noir ? "rounded-sm" : "rounded-2xl")}>{line}</p>
        {next && (
          <Link href={`/learn/lesson?unit=${next.unit.id}`} className={buttonStyles("primary", "md", "w-full")} aria-label={`이어서 하기: ${next.unit.title}`}>
            ▶ {next.unit.title}
          </Link>
        )}
        {next && (
          <p className="truncate text-xs text-ink-soft">
            {next.section} · 약 {next.unit.minutes}분
          </p>
        )}
      </div>
    </Card>
  );
}

/** 오늘 학습 목표(분)를 채운 정도를 원으로 */
function GoalRing() {
  const today = toDateKey();
  const d = useLiveQuery(() => dailyLearn(today), [today]);
  if (!d) return null;
  const minutes = Math.floor(d.todaySeconds / 60);
  const ratio = Math.min(1, d.todaySeconds / (d.goalMinutes * 60));
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`오늘 학습 ${minutes}분 / 목표 ${d.goalMinutes}분${d.goalStreak ? `, 목표 ${d.goalStreak}일 연속` : ""}`}>
      <svg viewBox="0 0 40 40" className="size-10 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={ratio >= 1 ? "var(--success)" : "var(--xp)"} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * ratio} ${c}`} />
      </svg>
      <span className="font-display text-sm leading-tight">
        {minutes}/{d.goalMinutes}분
        {d.goalStreak > 0 && <span className="block text-[11px] text-ink-soft">🎯 {d.goalStreak}일 연속</span>}
      </span>
    </div>
  );
}
