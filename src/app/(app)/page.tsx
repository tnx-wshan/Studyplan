"use client";

import Link from "next/link";
import { CompanionCard } from "@/components/game/CompanionCard";
import { QuestBoard } from "@/components/game/QuestBoard";
import { ComebackCard, QuickStartCard, WeeklyGoalCard } from "@/components/game/RetentionCards";
import { MAX_FREEZES } from "@/lib/game/streak";
import { StudyGrass } from "@/components/StudyGrass";
import { DailyGoalCard } from "@/components/learn/DailyGoalCard";
import { buttonStyles, Card, SectionTitle } from "@/components/ui";
import { usePetState, useStudyDays } from "@/lib/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import { SubjectChip, useSubjectMap } from "@/components/kit";
import { getDB } from "@/lib/db";
import { toDateKey } from "@/lib/date";
import { useMinuteTick } from "@/lib/timerStore";
import { recommendedMethods, type Dimension } from "@/data/diagnosis";
import { METHODS, methodById } from "@/data/methods";
import { daysBetween } from "@/lib/date";

export default function HomePage() {
  const state = usePetState();
  const study = useStudyDays();
  if (!state || !study) return null;
  const { profile, streak } = state;

  return (
    <div className="space-y-5">
      <CompanionCard />

      <ComebackCard />

      <QuickStartCard studiedToday={streak.studiedToday} streak={streak.current} />

      <DailyGoalCard withLink />

      <WeeklyGoalCard />

      <QuestBoard />

      <TodayOverview />

      <TodayMethod />

      <div className="grid grid-cols-2 gap-3">
        <Link href="/timer" className={buttonStyles("primary", "lg", "w-full")}>
          ⏱️ 공부 시작
        </Link>
        <Link href="/methods" className={buttonStyles("accent", "lg", "w-full")}>
          💡 학습법
        </Link>
      </div>

      <section>
        <SectionTitle
          action={
            <span className="text-sm text-ink-soft">
              <span title="연속 기록 보호권: 하루 쉬어도 연속 기록을 지켜줘요">🛡️ {profile.freezes ?? 0}/{MAX_FREEZES}</span> · 최장 {streak.longest}일
            </span>
          }
        >
          🔥 공부 잔디 · {streak.current}일 연속
        </SectionTitle>
        <Card>
          <StudyGrass days={study.days} frozen={study.frozenDays} weeks={12} />
        </Card>
      </section>

      {profile.goal && (
        <Card className="flex items-center gap-3">
          <span aria-hidden className="text-2xl">
            🎯
          </span>
          <div>
            <p className="text-xs text-ink-soft">나의 목표</p>
            <p className="font-display">{profile.goal}</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function TodayOverview() {
  const today = toDateKey();
  const tick = useMinuteTick();
  const subjectMap = useSubjectMap();
  const data = useLiveQuery(async () => {
    const db = getDB();
    const now = Date.now();
    const [tasks, cards, wrong] = await Promise.all([
      db.tasks.where("date").equals(today).toArray(),
      db.cards.where("due").belowOrEqual(now).count(),
      db.wrongAnswers.where("nextRetry").belowOrEqual(today).filter((w) => !w.mastered).count(),
    ]);
    return { tasks: tasks.sort((a, b) => a.order - b.order), cards, wrong };
  }, [today, tick]);
  if (!data) return null;
  const undone = data.tasks.filter((t) => !t.done);

  return (
    <section>
      <SectionTitle action={<Link href="/planner" className="text-sm text-ink-soft underline">플래너</Link>}>
        오늘 할 일 {data.tasks.length > 0 && <span className="text-sm text-ink-soft">{data.tasks.length - undone.length}/{data.tasks.length}</span>}
      </SectionTitle>
      <Card className="space-y-2">
        {undone.length === 0 ? (
          <p className="py-2 text-center text-sm text-ink-soft">{data.tasks.length ? "오늘 할 일을 모두 끝냈어요! 🎉" : "오늘 계획이 없어요. 플래너에서 할 일을 추가해 보세요."}</p>
        ) : (
          <ul className="space-y-1.5">
            {undone.slice(0, 3).map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <SubjectChip subject={t.subjectId ? subjectMap.get(t.subjectId) : undefined} />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <Link href={`/timer?task=${t.id}`} aria-label={`${t.title} 타이머 시작`}>
                  ⏱️
                </Link>
              </li>
            ))}
            {undone.length > 3 && <li className="text-xs text-ink-soft">외 {undone.length - 3}개</li>}
          </ul>
        )}
        {(data.cards > 0 || data.wrong > 0) && (
          <div className="flex gap-2 border-t-2 border-line pt-2">
            {data.cards > 0 && (
              <Link href="/review/cards/study" className={buttonStyles("ghost", "sm", "flex-1")}>
                🃏 카드 {data.cards}장
              </Link>
            )}
            {data.wrong > 0 && (
              <Link href="/review/wrong/retry" className={buttonStyles("ghost", "sm", "flex-1")}>
                📝 오답 {data.wrong}개
              </Link>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}

/** 오늘의 학습법: 진단 결과 추천을 우선으로, 날마다 하나씩 돌아가며 보여준다 */
function TodayMethod() {
  const state = usePetState();
  if (!state) return null;
  const scores = state.profile.diagnosis?.scores as Record<Dimension, number> | undefined;
  const pool = scores ? recommendedMethods(scores) : METHODS.filter((m) => m.evidence === "high").map((m) => m.id);
  const day = daysBetween("2026-01-01", toDateKey());
  const method = methodById(pool[((day % pool.length) + pool.length) % pool.length]);
  if (!method) return null;
  return (
    <Link href={`/methods/detail?id=${method.id}`} className="block">
      <Card className="flex items-center gap-3 border-accent bg-accent/5">
        <span aria-hidden className="text-3xl">
          {method.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-soft">{scores ? "나에게 맞는 오늘의 학습법" : "오늘의 학습법"}</p>
          <p className="font-display">{method.name}</p>
          <p className="truncate text-sm text-ink-soft">{method.oneLine}</p>
        </div>
        <span aria-hidden className="text-ink-soft">
          ›
        </span>
      </Card>
    </Link>
  );
}
