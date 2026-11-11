"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { dailyLearn } from "@/lib/db/learn";
import { toDateKey } from "@/lib/date";
import { Card, ProgressBar, buttonStyles, cn } from "../ui";
import { useUiStyle } from "../ThemeSync";

const DOW = ["월", "화", "수", "목", "금", "토", "일"];

/** 하루 학습 목표(기본 5분)와 이번 주 기록. 홈에서는 '이어서 하기' 단추를 함께 보여준다 */
export function DailyGoalCard({ withLink = false }: { withLink?: boolean }) {
  const noir = useUiStyle() === "noir";
  const today = toDateKey();
  const d = useLiveQuery(() => dailyLearn(today), [today]);
  if (!d) return null;
  const minutes = Math.floor(d.todaySeconds / 60);
  const met = d.todaySeconds >= d.goalMinutes * 60;
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-display">{met ? (noir ? "오늘의 몫은 끝났다" : "오늘 목표 달성! 🎉") : noir ? `오늘의 학습 ${d.goalMinutes}분` : `오늘의 학습 목표 ${d.goalMinutes}분`}</p>
          <p className="text-xs text-ink-soft">
            {minutes}분 / {d.goalMinutes}분 · 유닛 {d.todayUnits}개{d.goalStreak > 0 ? ` · 목표 ${d.goalStreak}일 연속` : ""}
          </p>
        </div>
        {withLink && (
          <Link href="/learn" className={buttonStyles(met ? "ghost" : "primary", "sm")}>
            {met ? "더 하기" : "이어서 하기"}
          </Link>
        )}
      </div>
      <ProgressBar value={d.todaySeconds / (d.goalMinutes * 60)} label="오늘 학습 목표" color={met ? "var(--success)" : "var(--xp)"} />
      <ol className="grid grid-cols-7 gap-1 text-center text-[11px]" aria-label="이번 주 학습">
        {d.week.map((w, i) => {
          const hit = w.seconds >= d.goalMinutes * 60;
          return (
            <li key={w.date} className="space-y-0.5">
              <span
                aria-hidden
                className={cn("mx-auto block size-6 rounded-full border-2", hit ? "border-success bg-success" : w.seconds > 0 ? "border-xp bg-xp/30" : "border-line", w.date === today && "outline-2 outline-offset-1 outline-accent")}
              />
              <span className={cn(w.date === today ? "font-display" : "text-ink-soft")}>{DOW[i]}</span>
              <span className="sr-only">{hit ? "목표 달성" : w.seconds > 0 ? `${Math.round(w.seconds / 60)}분` : "안 함"}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
