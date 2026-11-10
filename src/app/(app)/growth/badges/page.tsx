"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { useUiStyle } from "@/components/ThemeSync";
import { Card, ProgressBar, cn } from "@/components/ui";
import { getDB } from "@/lib/db";
import { computeTotals, setTitleBadge } from "@/lib/db/game";
import { BADGES, TIER_LABELS, badgeProgress } from "@/lib/game/achievements";
import { useProfile } from "@/lib/hooks";

const TIER_COLORS = { 1: "#b0794a", 2: "#a9b1bb", 3: "#c9a45c" } as const;

export default function BadgesPage() {
  const style = useUiStyle();
  const noir = style === "noir";
  const profile = useProfile();
  const data = useLiveQuery(async () => {
    const [totals, earned] = await Promise.all([computeTotals(), getDB().userBadges.toArray()]);
    return { totals, earned: new Map(earned.map((b) => [b.badgeId, b.createdAt])) };
  }, []);
  if (!data || !profile) return null;
  const count = BADGES.filter((b) => data.earned.has(b.id)).length;

  return (
    <div className="space-y-4">
      <PageHeader title={noir ? "업적 기록" : "🏆 업적·칭호"} back="/growth" />
      <Card className="flex items-center justify-between">
        <div>
          <p className="kicker">Achievements</p>
          <p className="font-display text-2xl">
            {count} / {BADGES.length}
          </p>
        </div>
        <p className="max-w-[60%] text-right text-xs text-ink-soft">달성한 업적을 눌러 칭호로 쓰면 홈 화면 이름 아래에 표시돼요.</p>
      </Card>
      <ul className="grid grid-cols-2 gap-2">
        {BADGES.map((b) => {
          const got = data.earned.has(b.id);
          const isTitle = profile.titleBadge === b.id;
          const name = noir ? b.noirName : b.name;
          return (
            <li key={b.id}>
              <button
                type="button"
                disabled={!got}
                aria-pressed={isTitle}
                onClick={async () => {
                  await setTitleBadge(isTitle ? undefined : b.id);
                  toast(isTitle ? "칭호를 뺐어요" : `칭호: ${name}`);
                }}
                className={cn("card relative flex h-full w-full flex-col gap-1.5 rounded-3xl border-2 bg-surface p-3 text-left", isTitle ? "border-accent" : "border-line", !got && "opacity-60")}
              >
                <span className="flex items-center justify-between">
                  <span aria-hidden className={cn("text-3xl", !got && "grayscale")}>
                    {got ? b.icon : "🔒"}
                  </span>
                  <span className="font-mono text-[10px] tracking-widest" style={{ color: TIER_COLORS[b.tier] }}>
                    {TIER_LABELS[b.tier][style]}
                  </span>
                </span>
                <span className="font-display">{name}</span>
                <span className="text-xs text-ink-soft">{b.description}</span>
                {got ? (
                  <span className="text-[11px] text-success-deep">
                    {new Date(data.earned.get(b.id)!).toLocaleDateString("ko-KR")} 달성{isTitle ? " · 칭호 사용 중" : ""}
                  </span>
                ) : (
                  <ProgressBar value={badgeProgress(b, data.totals)} className="h-2 border-0" color="var(--accent)" label={`${name} 진행률`} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
