"use client";

import Link from "next/link";
import { Pet } from "@/components/Pet";
import { StudyGrass } from "@/components/StudyGrass";
import { buttonStyles, Card, ProgressBar, SectionTitle } from "@/components/ui";
import { usePetState, useStudyDays } from "@/lib/hooks";
import { PET_MOOD_TEXT } from "@/lib/game/pet";

/** 받침이 있으면 "으로", 없거나 ㄹ받침이면 "로" */
function withRo(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const jong = code >= 0 && code < 11172 ? code % 28 : 0;
  return word + (jong === 0 || jong === 8 ? "로" : "으로");
}

const STARTER_QUESTS = [
  { icon: "⏱️", title: "집중 타이머로 25분 공부하기", reward: 25 },
  { icon: "🗓️", title: "오늘의 계획 3개 세우기", reward: 30 },
  { icon: "🃏", title: "복습 카드 10장 넘기기", reward: 20 },
];

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

      <section>
        <SectionTitle>오늘의 퀘스트</SectionTitle>
        <Card className="space-y-2">
          {STARTER_QUESTS.map((q) => (
            <div key={q.title} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <span aria-hidden className="text-2xl">
                {q.icon}
              </span>
              <span className="flex-1 text-sm">{q.title}</span>
              <span className="font-display text-sm text-xp-deep">+{q.reward} XP</span>
            </div>
          ))}
          <p className="pt-1 text-center text-xs text-ink-soft">퀘스트는 1단계 기능이 열리면 진행돼요.</p>
        </Card>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/planner" className={buttonStyles("primary", "lg", "w-full")}>
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
