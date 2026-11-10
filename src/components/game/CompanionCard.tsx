"use client";

import Link from "next/link";
import { Pet } from "../Pet";
import { useUiStyle } from "../ThemeSync";
import { Card, ProgressBar, cn } from "../ui";
import { backgroundStyle } from "@/data/shop";
import { badgeById } from "@/lib/game/achievements";
import { terms } from "@/lib/game/companion";
import { usePetState } from "@/lib/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db";
import { unreadCount } from "@/data/story";
import { withRo } from "@/lib/korean";

/** 홈의 펫/동료 카드 */
export function CompanionCard() {
  const state = usePetState();
  const style = useUiStyle();
  const badges = useLiveQuery(async () => new Set((await getDB().userBadges.toArray()).map((b) => b.badgeId)), []);
  if (!state) return null;
  const unread = badges ? unreadCount(style, state.level.level, badges, state.profile.readRecords ?? []) : 0;
  const { profile, level, stage, next, mood } = state;
  const t = terms(style);
  const noir = style === "noir";
  const title = badgeById(profile.titleBadge);
  const bg = backgroundStyle(profile.equipped?.background, noir);

  return (
    <Card className={cn("overflow-hidden p-0 text-center", !bg && "bg-gradient-to-b from-bg-soft to-surface")}>
      <div className="relative px-4 pt-4" style={bg}>
        <div className="absolute right-3 top-3 flex gap-1.5">
          <Link href="/companion/records" className="relative rounded-full bg-surface/80 px-2.5 py-1 text-xs backdrop-blur" aria-label={noir ? "동료의 기록" : "펫의 일기"}>
            {noir ? "기록" : "📔 일기"}
            {unread > 0 && (
              <span className="font-display absolute -right-1 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-white" aria-label={`새 기록 ${unread}개`}>
                {unread}
              </span>
            )}
          </Link>
          <Link href="/companion" className="rounded-full bg-surface/80 px-2.5 py-1 text-xs backdrop-blur" aria-label={`${t.pet} 꾸미기`}>
            {noir ? "장비" : "🎀 꾸미기"}
          </Link>
        </div>
        <p className="kicker text-left">Companion · {t.speciesLabel(profile.pet.species)}</p>
        <p className="font-display text-sm text-ink-soft">
          {t.stageLabel(stage.stage)}
          {t.stageSuffix}
        </p>
        <h1 className="font-display text-2xl">{profile.pet.name}</h1>
        {title && (
          <p className={cn("mt-0.5 text-xs", noir ? "text-accent" : "text-primary-deep")}>
            {noir ? `「${title.noirName}」` : `${title.icon} ${title.name}`}
          </p>
        )}
        <div className="flex justify-center py-2">
          <Pet species={profile.pet.species} stage={stage.stage} mood={mood} size={180} accessory={profile.equipped?.accessory} />
        </div>
      </div>
      <div className="space-y-3 px-4 pb-4 pt-2">
        <p className={cn("mx-auto inline-block px-3 py-1.5 text-sm", noir ? "border-l-2 border-accent text-left italic text-ink-soft" : "rounded-2xl bg-surface shadow-[var(--shadow)]")}>
          {noir ? t.mood(mood) : `“${t.mood(mood)}”`}
        </p>
        <div className="space-y-1 text-left">
          <div className="flex justify-between text-sm">
            <span className="font-display">{noir ? `RANK ${level.level}` : `Lv.${level.level}`}</span>
            <span className="tabular-nums text-ink-soft">
              {level.current} / {level.needed} XP
            </span>
          </div>
          <ProgressBar value={level.progress} label="다음 레벨까지 경험치" className={noir ? "h-2 border-0" : undefined} />
          {next && (
            <p className="text-xs text-ink-soft">
              {noir ? `RANK ${next.minLevel} — ${t.stageLabel(next.stage)}` : `Lv.${next.minLevel}에 도달하면 ${withRo(next.label)} 자라요!`}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
