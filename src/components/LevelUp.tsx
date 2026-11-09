"use client";

import { dismissLevelUp } from "@/lib/db/profile";
import { stageForLevel } from "@/lib/game/pet";
import { usePetState } from "@/lib/hooks";
import { Pet } from "./Pet";
import { Button } from "./ui";

/** 레벨이 오르면 축하 화면을 띄운다. 펫이 다음 단계로 자라면 함께 알려준다. */
export function LevelUp() {
  const state = usePetState();
  const from = state?.profile.levelUpFrom;
  if (!state || from === undefined) return null;
  const level = state.level.level;
  const stage = stageForLevel(level);
  const grew = stage.stage !== stageForLevel(from).stage;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="levelup-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="pop-in w-full max-w-sm rounded-3xl border-2 border-line bg-surface p-6 text-center">
        <p className="font-display text-sm text-xp-deep">LEVEL UP!</p>
        <h2 id="levelup-title" className="font-display text-3xl">
          Lv.{level}
        </h2>
        <div className="flex justify-center py-3">
          <Pet species={state.profile.pet.species} stage={stage.stage} mood="excited" size={150} />
        </div>
        <p className="mb-4">
          {grew ? (
            <>
              {state.profile.pet.name}(이)가 <b className="font-display">{stage.label}</b> 단계로 자랐어요!
            </>
          ) : (
            <>{state.profile.pet.name}(이)가 기뻐하고 있어요!</>
          )}
        </p>
        <Button className="w-full" onClick={() => dismissLevelUp()}>
          좋아요!
        </Button>
      </div>
    </div>
  );
}
