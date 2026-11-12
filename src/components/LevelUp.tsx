"use client";

import { dismissLevelUp } from "@/lib/db/profile";
import { terms } from "@/lib/game/companion";
import { growthStage } from "@/data/characters";
import { shopItem } from "@/data/shop";
import { MAP_SKIN_NAMES, rewardsForLevel, type LevelReward } from "@/lib/game/rewards";
import { usePetState } from "@/lib/hooks";
import { CharacterArt, useActiveCharacter, useCharacterAssets } from "./game/CharacterArt";
import { useUiStyle } from "./ThemeSync";
import Link from "next/link";
import { storyFor } from "@/data/story";
import { Button, buttonStyles, cn } from "./ui";

const CONFETTI = ["#ff8a3d", "#6c5ce7", "#3fbf6f", "#ffc83d", "#f05454"];

/** 레벨이 오르면 축하 화면. 누아르는 절제된 황동빛 연출, 귀여운 스타일은 색종이. */
export function LevelUp() {
  const state = usePetState();
  const style = useUiStyle();
  const active = useActiveCharacter();
  const assets = useCharacterAssets();
  const from = state?.profile.levelUpFrom;
  if (!state || !active || from === undefined) return null;
  const noir = style === "noir";
  const t = terms(style);
  const level = state.level.level;
  const grew = growthStage(level) !== growthStage(from);
  const name = state.profile.pet.name;
  // 이번에 오른 레벨들의 보상 (이야기는 아래 단추로 따로 알린다)
  const rewards = Array.from({ length: Math.max(0, level - from) }, (_, i) => rewardsForLevel(from + 1 + i))
    .flat()
    .filter((r) => r.kind !== "story");
  const coins = rewards.reduce((s, r) => s + (r.kind === "coins" ? r.amount : 0), 0);
  const lines = [...(coins ? [`🪙 코인 +${coins}`] : []), ...rewards.filter((r) => r.kind !== "coins").map((r) => rewardLabel(r, noir, active.character.titles[growthStage(level)]))];
  // 이번에 오른 레벨 구간에서 새로 열린 기록
  const newRecords = storyFor(style).filter((e) => "level" in e.unlock && e.unlock.level > from && e.unlock.level <= level);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="levelup-title" className={cn("fixed inset-0 z-50 flex items-center justify-center p-6", noir ? "bg-black/80" : "bg-black/50")}>
      {noir ? (
        <div aria-hidden className="levelup-rays pointer-events-none absolute inset-0" />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 24 }, (_, i) => (
            <span
              key={i}
              className="confetti absolute top-0 block h-3 w-2"
              style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 8) * 0.12}s` }}
            />
          ))}
        </div>
      )}
      <div className={cn("pop-in relative w-full max-w-sm border-line bg-surface p-6 text-center", noir ? "card border" : "rounded-3xl border-2")}>
        <p className={cn("text-sm", noir ? "font-mono tracking-[0.4em] text-accent" : "font-display text-xp-deep")}>{t.levelUp}</p>
        <h2 id="levelup-title" className={cn("font-display", noir ? "mt-1 text-5xl" : "text-3xl")}>
          {noir ? level : `Lv.${level}`}
        </h2>
        {noir && <div aria-hidden className="mx-auto my-3 h-px w-24 bg-gradient-to-r from-transparent via-accent to-transparent" />}
        {/* 레벨 20 기념 장면: public/characters/<id>/scene-20.jpg 가 있으면 보여준다 */}
        {level >= 20 && assets?.[active.character.id]?.includes("scene-20.jpg") ? (
          // eslint-disable-next-line @next/next/no-img-element -- 관리자가 넣는 기념 장면 그림
          <img src={`/characters/${active.character.id}/scene-20.jpg`} alt={`${active.character.name} 레벨 20 기념 장면`} className="my-3 w-full rounded-lg object-cover" />
        ) : (
          <div className="flex justify-center py-3">
            <CharacterArt mood="excited" size={150} />
          </div>
        )}
        <p className="mb-3">{grew ? t.grew(name, active.title) : t.pleased(name)}</p>
        {lines.length > 0 && (
          <ul className={cn("mb-4 space-y-1 p-3 text-left text-sm", noir ? "border-l-2 border-accent bg-surface-2" : "rounded-2xl bg-surface-2")} aria-label="레벨업 보상">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        {newRecords.length > 0 && (
          <Link href="/companion/records" onClick={() => dismissLevelUp()} className={buttonStyles("accent", "md", "mb-2 w-full")}>
            {noir ? `새 기록이 열렸다 — 「${newRecords.at(-1)!.title}」` : `📔 새 일기가 열렸어요: ${newRecords.at(-1)!.title}`}
          </Link>
        )}
        <Button className="w-full" variant={newRecords.length > 0 ? "ghost" : "primary"} onClick={() => dismissLevelUp()}>
          {t.ok}
        </Button>
      </div>
    </div>
  );
}

function rewardLabel(r: LevelReward, noir: boolean, title: string): string {
  switch (r.kind) {
    case "freeze":
      return "🛡️ 연속 기록 보호권 +1";
    case "item": {
      const item = shopItem(r.itemId);
      return `🎁 꾸미기: ${item ? (noir ? item.noirName : item.name) : r.itemId}`;
    }
    case "growth":
      return `✨ 새 모습과 칭호: ${title}`;
    case "mapSkin":
      return `🗺️ 학습 지도 꾸미기: ${MAP_SKIN_NAMES[r.skin][noir ? "noir" : "cute"]}`;
    case "character":
      return "👥 다른 대표 캐릭터를 고를 수 있어요";
    case "frame":
      return r.frame === "gold" ? "🖼️ 금빛 프로필 테두리" : "🖼️ 은빛 프로필 테두리";
    case "sideStory":
      return noir ? "📜 외전 기록이 열렸다" : "📜 특별 일기가 열렸어요";
    case "scene":
      return "🎬 레벨 20 기념 장면";
    default:
      return "";
  }
}
