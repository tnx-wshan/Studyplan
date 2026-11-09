"use client";

import Link from "next/link";
import { Pet } from "@/components/Pet";
import { StudyGrass } from "@/components/StudyGrass";
import { Button, buttonStyles, Card, ProgressBar, SectionTitle } from "@/components/ui";
import { usePetState, useStudyDays } from "@/lib/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import { SubjectChip, useSubjectMap } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { getDB } from "@/lib/db";
import { claimQuest, dailyStats } from "@/lib/db/study";
import { toDateKey } from "@/lib/date";
import { DAILY_QUESTS, questProgress } from "@/lib/game/quests";
import { useMinuteTick } from "@/lib/timerStore";
import { PET_MOOD_TEXT } from "@/lib/game/pet";

/** 받침이 있으면 "으로", 없거나 ㄹ받침이면 "로" */
function withRo(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const jong = code >= 0 && code < 11172 ? code % 28 : 0;
  return word + (jong === 0 || jong === 8 ? "로" : "으로");
}

export default function HomePage() {
  const state = usePetState();
  const study = useStudyDays();
  if (!state || !study) return null;
  const { profile, level, stage, next, mood, streak } = state;

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden bg-gradient-to-b from-bg-soft to-surface text-center">
        <p className="font-display text-sm text-ink-soft">{stage.label} 단계</p>
        <h1 className="font-display text-2xl">{profile.pet.name}</h1>
        <div className="flex justify-center py-2">
          <Pet species={profile.pet.species} stage={stage.stage} mood={mood} size={180} />
        </div>
        <p className="mx-auto mb-3 inline-block rounded-2xl bg-surface px-3 py-1.5 text-sm shadow-[var(--shadow)]">
          “{PET_MOOD_TEXT[mood]}”
        </p>
        <div className="space-y-1 text-left">
          <div className="flex justify-between text-sm">
            <span className="font-display">Lv.{level.level}</span>
            <span className="text-ink-soft">
              {level.current} / {level.needed} XP
            </span>
          </div>
          <ProgressBar value={level.progress} label="다음 레벨까지 경험치" />
          {next && (
            <p className="text-xs text-ink-soft">Lv.{next.minLevel}에 도달하면 {withRo(next.label)} 자라요!</p>
          )}
        </div>
      </Card>

      <DailyQuests />

      <TodayOverview />

      <div className="grid grid-cols-2 gap-3">
        <Link href="/timer" className={buttonStyles("primary", "lg", "w-full")}>
          ⏱️ 공부 시작
        </Link>
        <Link href="/methods" className={buttonStyles("accent", "lg", "w-full")}>
          💡 학습법
        </Link>
      </div>

      <section>
        <SectionTitle action={<span className="text-sm text-ink-soft">최장 {streak.longest}일</span>}>
          🔥 공부 잔디 · {streak.current}일 연속
        </SectionTitle>
        <Card>
          <StudyGrass days={study.days} weeks={12} />
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

function DailyQuests() {
  const today = toDateKey();
  const stats = useLiveQuery(() => dailyStats(today), [today]);
  const claimed = useLiveQuery(async () => new Set((await getDB().userQuests.where("period").equals(today).toArray()).map((q) => q.questId)), [today]);
  if (!stats || !claimed) return null;
  const doneCount = DAILY_QUESTS.filter((q) => claimed.has(q.id)).length;

  return (
    <section>
      <SectionTitle action={<span className="font-display text-sm text-ink-soft">{doneCount}/{DAILY_QUESTS.length} 완료</span>}>오늘의 퀘스트</SectionTitle>
      <Card className="space-y-2">
        {DAILY_QUESTS.map((q) => {
          const p = questProgress(q, stats);
          const got = claimed.has(q.id);
          return (
            <div key={q.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <span aria-hidden className="text-2xl">
                {got ? "🏅" : q.icon}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={q.href} className={got ? "text-sm text-ink-soft line-through" : "text-sm"}>
                  {q.title}
                </Link>
                {!got && (
                  <div className="mt-1 flex items-center gap-2">
                    <ProgressBar value={p.ratio} className="h-2.5 border-0" color={p.done ? "var(--success)" : "var(--xp)"} label={`${q.title} 진행률`} />
                    <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                      {p.value}/{q.target}
                    </span>
                  </div>
                )}
              </div>
              {got ? (
                <span className="font-display text-sm text-success-deep">완료</span>
              ) : p.done ? (
                <Button
                  size="sm"
                  variant="success"
                  onClick={async () => {
                    if (await claimQuest(q.id, today)) toast(`퀘스트 완료! +${q.reward} XP`);
                  }}
                >
                  +{q.reward} 받기
                </Button>
              ) : (
                <span className="font-display text-sm text-xp-deep">+{q.reward} XP</span>
              )}
            </div>
          );
        })}
      </Card>
    </section>
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
