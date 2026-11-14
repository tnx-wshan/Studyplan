"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { formatDateKey } from "../kit";
import { toast } from "../Toaster";
import { useUiStyle } from "../ThemeSync";
import { Button, Card, ProgressBar, SectionTitle, cn } from "../ui";
import { getDB } from "@/lib/db";
import { claimExamMilestone, claimWeeklyQuest, examQuestStatus, weeklyStatus } from "@/lib/db/game";
import { claimQuest, dailyStats } from "@/lib/db/study";
import { FREEZE_QUESTS_NEEDED, maybeAwardFreeze } from "@/lib/db/retention";
import { daysBetween, toDateKey } from "@/lib/date";
import { DAILY_QUESTS, questProgress } from "@/lib/game/quests";

type Tab = "daily" | "weekly" | "exam";

interface Row {
  key: string;
  icon: string;
  title: string;
  value: number;
  target: number;
  reward: number;
  done: boolean;
  claimed: boolean;
  href?: string;
  onClaim: () => Promise<boolean>;
}

export function QuestBoard() {
  const style = useUiStyle();
  const noir = style === "noir";
  const today = toDateKey();
  const [tab, setTab] = useState<Tab>("daily");

  const daily = useLiveQuery(async () => {
    const stats = await dailyStats(today);
    const claimed = new Set((await getDB().userQuests.where("period").equals(today).toArray()).map((q) => q.questId));
    return DAILY_QUESTS.map<Row>((q) => {
      const p = questProgress(q, stats);
      return { key: q.id, icon: q.icon, title: q.title, value: p.value, target: q.target, reward: q.reward, done: p.done, claimed: claimed.has(q.id), href: q.href, onClaim: () => claimQuest(q.id, today) };
    });
  }, [today]);

  const weekly = useLiveQuery(async () => {
    const s = await weeklyStatus(today);
    return s.quests.map<Row>(({ quest, value, done, claimed }) => ({
      key: quest.id,
      icon: quest.icon,
      title: noir ? quest.noirTitle : quest.title,
      value,
      target: quest.target,
      reward: quest.reward,
      done,
      claimed,
      onClaim: async () => {
        const ok = await claimWeeklyQuest(quest.id, today);
        if (ok && (await maybeAwardFreeze(s.week))) toast(noir ? "보호권 획득 — 하루의 공백을 막아 준다" : "🛡️ 연속 기록 보호권을 받았어요!");
        return ok;
      },
    }));
  }, [today, noir]);

  const exams = useLiveQuery(() => examQuestStatus(today), [today]);

  const rows = tab === "daily" ? daily : tab === "weekly" ? weekly : undefined;
  const doneDaily = daily?.filter((r) => r.claimed).length ?? 0;

  return (
    <section>
      <SectionTitle action={tab === "daily" && <span className="font-display text-sm text-ink-soft">{doneDaily}/{DAILY_QUESTS.length} 완료</span>}>
        <span className="kicker">Contracts</span>
        {noir ? "의뢰" : "퀘스트"}
      </SectionTitle>
      <div className="mb-2 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1" role="tablist" aria-label="퀘스트 종류">
        {(
          [
            ["daily", noir ? "일일" : "오늘"],
            ["weekly", "주간"],
            ["exam", "시험"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("font-display rounded-xl py-1.5 text-sm", tab === id ? "bg-surface shadow-[var(--shadow)]" : "text-ink-soft")}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="space-y-2" role="tabpanel">
        {tab === "weekly" && (
          <p className="text-xs text-ink-soft">
            🛡️ 주간 {noir ? "의뢰" : "퀘스트"} {FREEZE_QUESTS_NEEDED}개를 완수하면 연속 기록 보호권을 받아요 (최대 2개, 레벨 10부터 3개). 하루 쉬어도 연속 기록이 유지돼요.
          </p>
        )}
        {tab !== "exam" && rows?.map((r) => <QuestRow key={r.key} row={r} noir={noir} />)}
        {tab === "exam" &&
          (exams && exams.length > 0 ? (
            exams.map((e) => (
              <div key={e.exam.id} className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={`/planner/exam?id=${e.exam.id}`} className="font-display truncate underline-offset-2 hover:underline">
                    {e.exam.title}
                  </Link>
                  <span className="shrink-0 text-xs text-ink-soft">
                    D-{daysBetween(today, e.exam.date)} · {formatDateKey(e.exam.date, false)} · {e.progress.pct}%
                  </span>
                </div>
                {e.milestones.map((m) => (
                  <QuestRow
                    key={m.id}
                    noir={noir}
                    row={{
                      key: m.id,
                      icon: m.pct === 100 ? "🏁" : "🚩",
                      title: `${noir ? m.noirTitle : m.title} (계획 ${m.pct}%)`,
                      value: Math.min(e.progress.pct, m.pct),
                      target: m.pct,
                      reward: m.reward,
                      done: m.reached,
                      claimed: m.claimed,
                      onClaim: () => claimExamMilestone(e.exam.id, m.pct, today),
                    }}
                  />
                ))}
              </div>
            ))
          ) : (
            <p className="py-3 text-center text-sm text-ink-soft">
              다가오는 시험이 없어요.{" "}
              <Link href="/planner/exam/new" className="underline">
                시험 계획을 만들면
              </Link>{" "}
              단계별 퀘스트가 열려요.
            </p>
          ))}
      </Card>
    </section>
  );
}

function QuestRow({ row, noir }: { row: Row; noir: boolean }) {
  const [busy, setBusy] = useState(false);
  const label = row.href ? (
    <Link href={row.href} className={row.claimed ? "text-sm text-ink-soft line-through" : "text-sm"}>
      {row.title}
    </Link>
  ) : (
    <span className={row.claimed ? "text-sm text-ink-soft line-through" : "text-sm"}>{row.title}</span>
  );
  return (
    <div className={cn("flex items-center gap-3 p-3", noir ? "border-l-2 bg-surface-2" : "rounded-2xl bg-surface-2", noir && (row.claimed ? "border-success" : row.done ? "border-accent" : "border-line"))}>
      <span aria-hidden className="text-2xl">
        {row.claimed ? (noir ? "✓" : "🏅") : row.icon}
      </span>
      <div className="min-w-0 flex-1">
        {label}
        {!row.claimed && (
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar value={row.value / row.target} className="h-2.5 border-0" color={row.done ? "var(--success)" : "var(--xp)"} label={`${row.title} 진행률`} />
            <span className="shrink-0 text-xs tabular-nums text-ink-soft">
              {row.value}/{row.target}
            </span>
          </div>
        )}
      </div>
      {row.claimed ? (
        <span className="font-display text-sm text-success-deep">{noir ? "완수" : "완료"}</span>
      ) : row.done ? (
        <Button
          size="sm"
          variant="success"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (await row.onClaim()) toast(`${noir ? "의뢰 완수" : "퀘스트 완료!"} +${row.reward} XP`);
            setBusy(false);
          }}
        >
          +{row.reward} 받기
        </Button>
      ) : (
        <span className="font-display text-sm text-xp-deep">+{row.reward} XP</span>
      )}
    </div>
  );
}
