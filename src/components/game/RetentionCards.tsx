"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMinutes } from "../kit";
import { toast } from "../Toaster";
import { useUiStyle } from "../ThemeSync";
import { Button, Card, ProgressBar, cn } from "../ui";
import {
  GOAL_CHOICES,
  GOAL_REWARD,
  claimComebackQuest,
  claimWeeklyGoal,
  comebackStatus,
  setWeeklyGoal,
  tidyBacklog,
  weeklyGoalStatus,
} from "@/lib/db/retention";
import { toDateKey } from "@/lib/date";
import { QUICK_MINUTES, startQuick } from "@/lib/study/timer";
import { getTimer, setTimer, useTimerState } from "@/lib/timerStore";
import { askConfirm } from "@/components/Dialogs";

/** 오래 쉬었다 돌아온 날: 밀린 일 대신 가벼운 복귀 퀘스트 3개 */
export function ComebackCard() {
  const noir = useUiStyle() === "noir";
  const today = toDateKey();
  const status = useLiveQuery(() => comebackStatus(today), [today]);
  const [busy, setBusy] = useState(false);
  if (!status) return null;
  const allClaimed = status.quests.every((q) => q.claimed);

  async function onTidy() {
    if (!(await askConfirm("지난 간격 복습 할 일은 지우고, 다가오는 시험 계획은 남은 날에 맞춰 다시 짤까요? 직접 만든 할 일은 그대로 둬요."))) return;
    setBusy(true);
    const r = await tidyBacklog(today);
    toast(`정리 완료: 복습 ${r.removedReviews}개 정리${r.replannedExams ? `, 시험 계획 ${r.replannedExams}개 다시 짬` : ""}`);
    setBusy(false);
  }

  return (
    <Card className="space-y-3 border-accent">
      <div>
        <p className="kicker">Welcome back</p>
        <p className="font-display text-lg">{noir ? `${status.awayDays}일 만의 귀환` : `다시 와서 반가워요! 👋`}</p>
        <p className="text-sm text-ink-soft">
          {noir ? "밀린 것은 잊어도 된다. 오늘은 이 세 가지만." : `${status.awayDays}일 쉬었어요. 밀린 건 신경 쓰지 말고, 오늘은 이 세 가지만 해 봐요.`}
        </p>
      </div>
      <ul className="space-y-2">
        {status.quests.map(({ quest, done, claimed }) => (
          <li key={quest.id} className={cn("flex items-center gap-3 p-2.5", noir ? "border-l-2 bg-surface-2" : "rounded-2xl bg-surface-2", noir && (claimed ? "border-success" : done ? "border-accent" : "border-line"))}>
            <span aria-hidden className="text-xl">
              {claimed ? "✓" : quest.icon}
            </span>
            <Link href={quest.href} className={cn("flex-1 text-sm", claimed && "text-ink-soft line-through")}>
              {noir ? quest.noirTitle : quest.title}
            </Link>
            {claimed ? (
              <span className="font-display text-sm text-success-deep">완료</span>
            ) : done ? (
              <Button size="sm" variant="success" onClick={async () => (await claimComebackQuest(quest.id, today)) && toast(`복귀 퀘스트 완료! +${quest.reward} XP`)}>
                +{quest.reward} 받기
              </Button>
            ) : (
              <span className="font-display text-sm text-xp-deep">+{quest.reward} XP</span>
            )}
          </li>
        ))}
      </ul>
      {allClaimed && <p className="text-center text-sm">{noir ? "돌아왔다. 기록은 다시 이어진다." : "돌아온 첫날을 멋지게 해냈어요! 🎉"}</p>}
      {status.backlog > 0 && (
        <Button variant="ghost" size="sm" className="w-full" disabled={busy} onClick={onTidy}>
          🧹 밀린 할 일 {status.backlog}개 한 번에 정리
        </Button>
      )}
    </Card>
  );
}

/** 오늘 아직 기록이 없을 때: 5분만 시작하기 */
export function QuickStartCard({ studiedToday, streak }: { studiedToday: boolean; streak: number }) {
  const noir = useUiStyle() === "noir";
  const router = useRouter();
  const timer = useTimerState();
  if (studiedToday || timer.phase !== "idle") return null;
  return (
    <Card className="flex items-center gap-3">
      <span aria-hidden className="text-3xl">
        ⚡
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display">{noir ? "5분이면 충분하다" : "하기 싫은 날엔 5분만"}</p>
        <p className="text-sm text-ink-soft">{streak > 0 ? `5분만 해도 ${streak}일 연속 기록이 이어져요.` : "5분만 해도 오늘 기록이 남아요."}</p>
      </div>
      <Button
        size="sm"
        onClick={() => {
          setTimer(startQuick(getTimer(), Date.now(), getTimer().subjectId));
          router.push("/timer");
        }}
      >
        {QUICK_MINUTES}분 시작
      </Button>
    </Card>
  );
}

/** 이번 주 집중 시간 목표: 스스로 정하고 진행 정도를 본다 */
export function WeeklyGoalCard() {
  const noir = useUiStyle() === "noir";
  const today = toDateKey();
  const s = useLiveQuery(() => weeklyGoalStatus(today), [today]);
  const [editing, setEditing] = useState(false);
  if (!s) return null;

  if (s.goal === null || editing) {
    const choices = [...new Set([s.suggestion, ...GOAL_CHOICES])].sort((a, b) => a - b);
    return (
      <Card className="space-y-3">
        <div>
          <p className="kicker">Weekly pledge</p>
          <p className="font-display">{noir ? "이번 주의 서약" : "이번 주 목표를 정해요 🎯"}</p>
          <p className="text-sm text-ink-soft">
            {s.lastWeek > 0 ? `지난주에는 ${formatMinutes(s.lastWeek)} 집중했어요.` : "이번 주에 집중할 시간을 스스로 정해 보세요."} 조금 힘들지만 할 수 있는 만큼이 좋아요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="주간 목표 시간">
          {choices.map((m) => (
            <button
              key={m}
              type="button"
              onClick={async () => {
                await setWeeklyGoal(m, today);
                setEditing(false);
                toast(`이번 주 목표: ${formatMinutes(m)}`);
              }}
              className={cn("font-display rounded-full border-2 px-3 py-1.5 text-sm", m === s.suggestion ? "border-accent bg-accent/10" : "border-line")}
            >
              {formatMinutes(m)}
              {m === s.suggestion && <span className="ml-1 text-[11px] text-ink-soft">추천</span>}
            </button>
          ))}
        </div>
        {editing && (
          <button type="button" className="text-sm text-ink-soft underline" onClick={() => setEditing(false)}>
            취소
          </button>
        )}
      </Card>
    );
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="kicker">Weekly pledge</p>
          <p className="font-display">{noir ? "이번 주의 서약" : "이번 주 목표 🎯"}</p>
        </div>
        <p className="font-display tabular-nums">
          {formatMinutes(s.minutes)} <span className="text-sm text-ink-soft">/ {formatMinutes(s.goal)}</span>
        </p>
      </div>
      <ProgressBar value={s.minutes / s.goal} color={s.achieved ? "var(--success)" : "var(--accent)"} label="주간 목표 진행률" />
      {s.claimed ? (
        <p className="text-sm text-success-deep">{noir ? "서약을 지켰다." : "이번 주 목표 달성! 잘했어요 🎉"}</p>
      ) : s.achieved ? (
        <Button variant="success" size="sm" className="w-full" onClick={async () => (await claimWeeklyGoal(today)) && toast(`주간 목표 달성! +${GOAL_REWARD} XP`)}>
          목표 달성! +{GOAL_REWARD} XP 받기
        </Button>
      ) : (
        <div className="flex items-center justify-between gap-2 text-sm text-ink-soft">
          <span>
            남은 {s.daysLeft}일 동안 하루 {formatMinutes(s.perDay)}씩이면 달성해요
          </span>
          <button type="button" className="shrink-0 underline" onClick={() => setEditing(true)}>
            바꾸기
          </button>
        </div>
      )}
    </Card>
  );
}
