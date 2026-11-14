"use client";

import { CHARACTERS, SECOND_CHARACTER_LEVEL, activeCharacter, canUseCharacter, growthStage } from "@/data/characters";
import { updateProfile } from "@/lib/db/profile";
import { MAP_SKIN_LEVELS, MAP_SKIN_NAMES, mapSkinUnlocked, type MapSkin } from "@/lib/game/rewards";
import { usePetState } from "@/lib/hooks";
import { toast } from "../Toaster";
import { withWaGwa } from "@/lib/korean";
import { useUiStyle } from "../ThemeSync";
import { Card, SectionTitle, cn } from "../ui";
import { CharacterArt } from "./CharacterArt";

/** 대표 캐릭터 고르기: 자기 테마의 대표는 처음부터, 다른 테마 캐릭터는 레벨 10부터 */
export function CharacterPicker() {
  const state = usePetState();
  const style = useUiStyle();
  if (!state) return null;
  const noir = style === "noir";
  const level = state.level.level;
  const current = activeCharacter(state.profile.character, style, level);
  const stage = growthStage(level);
  return (
    <section>
      <SectionTitle>
        <span className="kicker">Character</span>
        {noir ? "대표 캐릭터" : "대표 캐릭터 고르기"}
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="대표 캐릭터">
        {CHARACTERS.map((c) => {
          const usable = canUseCharacter(c, style, level);
          const selected = current.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!usable}
              onClick={async () => {
                await updateProfile({ character: c.id });
                toast(noir ? `대표 캐릭터: ${c.name}` : `${withWaGwa(c.name)} 함께해요!`);
              }}
              className={cn("border-2 bg-surface p-3 text-left disabled:opacity-60", noir ? "rounded-sm" : "rounded-3xl", selected ? "border-accent" : "border-line")}
            >
              <div className="flex justify-center">
                <CharacterArt character={c} stage={stage} size={110} />
              </div>
              <p className="font-display">{c.name}</p>
              <p className="text-xs text-ink-soft">{c.titles[stage]}</p>
              <p className="mt-1 text-xs text-ink-soft">{usable ? c.role : `레벨 ${SECOND_CHARACTER_LEVEL}에 열려요`}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-soft">{current.description}</p>
    </section>
  );
}

/** 학습 지도 꾸미기: 레벨 5·15에 열린다 */
export function MapSkinPicker() {
  const state = usePetState();
  const style = useUiStyle();
  if (!state) return null;
  const level = state.level.level;
  const chosen = state.profile.mapSkin ?? "basic";
  return (
    <section>
      <SectionTitle>
        <span className="kicker">Map</span>
        학습 지도 꾸미기
      </SectionTitle>
      <Card className="flex flex-wrap gap-2" role="radiogroup" aria-label="학습 지도 꾸미기">
        {(Object.keys(MAP_SKIN_LEVELS) as MapSkin[]).map((skin) => {
          const open = mapSkinUnlocked(skin, level);
          return (
            <button
              key={skin}
              type="button"
              role="radio"
              aria-checked={chosen === skin}
              disabled={!open}
              onClick={() => updateProfile({ mapSkin: skin })}
              className={cn("font-display rounded-full border-2 px-3 py-1 text-sm disabled:opacity-60", chosen === skin ? "border-accent bg-accent text-white" : "border-line")}
            >
              {MAP_SKIN_NAMES[skin][style]}
              {!open && <span className="ml-1 text-xs">· Lv.{MAP_SKIN_LEVELS[skin]}</span>}
            </button>
          );
        })}
      </Card>
    </section>
  );
}
