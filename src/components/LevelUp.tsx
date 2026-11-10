"use client";

import { dismissLevelUp } from "@/lib/db/profile";
import { terms } from "@/lib/game/companion";
import { stageForLevel } from "@/lib/game/pet";
import { usePetState } from "@/lib/hooks";
import { Pet } from "./Pet";
import { useUiStyle } from "./ThemeSync";
import { Button, cn } from "./ui";

const CONFETTI = ["#ff8a3d", "#6c5ce7", "#3fbf6f", "#ffc83d", "#f05454"];

/** 레벨이 오르면 축하 화면. 누아르는 절제된 황동빛 연출, 귀여운 스타일은 색종이. */
export function LevelUp() {
  const state = usePetState();
  const style = useUiStyle();
  const from = state?.profile.levelUpFrom;
  if (!state || from === undefined) return null;
  const noir = style === "noir";
  const t = terms(style);
  const level = state.level.level;
  const stage = stageForLevel(level);
  const grew = stage.stage !== stageForLevel(from).stage;
  const name = state.profile.pet.name;

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
        <div className="flex justify-center py-3">
          <Pet species={state.profile.pet.species} stage={stage.stage} mood="excited" size={150} accessory={state.profile.equipped?.accessory} />
        </div>
        <p className="mb-4">{grew ? t.grew(name, t.stageLabel(stage.stage)) : t.pleased(name)}</p>
        <Button className="w-full" onClick={() => dismissLevelUp()}>
          {t.ok}
        </Button>
      </div>
    </div>
  );
}
