"use client";

import { useEffect, useState } from "react";
import { activeCharacter, growthStage, stageImage, type CharacterDef } from "@/data/characters";
import type { PetMood } from "@/lib/game/pet";
import { usePetState } from "@/lib/hooks";
import { Pet } from "../Pet";
import { useUiStyle } from "../ThemeSync";
import { cn } from "../ui";

type Assets = Record<string, string[]>;
let cache: Promise<Assets> | null = null;

/** public/characters 안에 들어 있는 캐릭터 그림 목록 (한 번만 묻는다) */
function loadAssets(): Promise<Assets> {
  if (!cache) {
    cache = fetch("/api/characters", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Assets>) : {}))
      .catch(() => ({}));
  }
  return cache;
}

export function useCharacterAssets(): Assets | null {
  const [assets, setAssets] = useState<Assets | null>(null);
  useEffect(() => {
    let alive = true;
    loadAssets().then((a) => alive && setAssets(a));
    return () => {
      alive = false;
    };
  }, []);
  return assets;
}

/** 지금 쓰는 대표 캐릭터와 성장 단계·칭호 */
export function useActiveCharacter(): { character: CharacterDef; stage: number; title: string; level: number } | null {
  const state = usePetState();
  const style = useUiStyle();
  if (!state) return null;
  const level = state.level.level;
  const character = activeCharacter(state.profile.character, style, level);
  const stage = growthStage(level);
  return { character, stage, title: character.titles[stage], level };
}

/**
 * 대표 캐릭터 그림. 성장 단계 그림(public/characters/<id>/stage-N.png)이 있으면 그것을,
 * 없으면 지금의 동료 그림(SVG)을 캐릭터의 테마 모양으로 보여준다.
 */
export function CharacterArt({ size = 160, mood = "happy", className, character: forced, stage: forcedStage }: { size?: number; mood?: PetMood; className?: string; character?: CharacterDef; stage?: number }) {
  const state = usePetState();
  const active = useActiveCharacter();
  const assets = useCharacterAssets();
  if (!state || !active) return null;
  const character = forced ?? active.character;
  const stage = forcedStage ?? active.stage;
  const file = stageImage(character.id, stage);
  const label = `${character.name} (${character.titles[stage]})`;
  if (assets?.[character.id]?.includes(file)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 관리자가 넣는 캐릭터 그림 (크기 고정, 투명 PNG)
      <img src={`/characters/${character.id}/${file}`} alt={label} width={size} height={size} className={cn("character-art object-contain", className)} style={{ width: size, height: size }} />
    );
  }
  return <Pet species={state.profile.pet.species} stage={state.stage.stage} mood={mood} size={size} accessory={state.profile.equipped?.accessory} className={className} styleOverride={character.theme} />;
}
