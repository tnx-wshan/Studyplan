import type { PetMood, PetSpecies, PetStage } from "./pet";
import { PET_MOOD_TEXT, PET_SPECIES, PET_STAGES } from "./pet";

/**
 * 스타일별 이름과 문구. 누아르에서는 펫을 '동료'로 부르고 성장을 '각성'으로 표현한다.
 */
export type UiStyleName = "cute" | "noir";

export const NOIR_SPECIES: Record<PetSpecies, { label: string; description: string; glow: string }> = {
  cloud: { label: "안개", description: "조용히 지켜보는 동료. 꾸준히 쌓인 기록에 반응한다.", glow: "#9fb4d0" },
  sprout: { label: "덩굴", description: "매일의 작은 성장을 먹고 자라는 동료.", glow: "#7fb08e" },
  flame: { label: "잿불", description: "집중이 깊을수록 밝게 타오르는 동료.", glow: "#e08a3c" },
};

const NOIR_STAGES: Record<PetStage, string> = {
  egg: "봉인",
  baby: "각성 I",
  child: "각성 II",
  teen: "각성 III",
  adult: "완전 각성",
};

const NOIR_MOOD: Record<PetMood, string> = {
  excited: "오늘의 기록이 쌓이고 있다. 이 흐름을 이어가자.",
  happy: "준비됐다. 오늘은 무엇을 기록할까.",
  sad: "기록이 끊겼다. 짧게라도 다시 시작하자.",
  sleepy: "오래 침묵했다. 공부를 시작하면 다시 깨어난다.",
};

export function terms(style: UiStyleName) {
  const noir = style === "noir";
  return {
    pet: noir ? "동료" : "펫",
    speciesLabel: (s: PetSpecies) => (noir ? NOIR_SPECIES[s].label : PET_SPECIES[s].label),
    speciesDescription: (s: PetSpecies) => (noir ? NOIR_SPECIES[s].description : PET_SPECIES[s].description),
    stageLabel: (s: PetStage) => (noir ? NOIR_STAGES[s] : (PET_STAGES.find((x) => x.stage === s)?.label ?? s)),
    stageSuffix: noir ? "" : " 단계",
    mood: (m: PetMood) => (noir ? NOIR_MOOD[m] : PET_MOOD_TEXT[m]),
    levelUp: noir ? "RANK UP" : "LEVEL UP!",
    grew: (name: string, stage: string) => (noir ? `${name}의 봉인이 풀렸다 — ${stage}` : `${name}(이)가 ${stage} 단계로 자랐어요!`),
    pleased: (name: string) => (noir ? `${name}이(가) 고개를 끄덕인다.` : `${name}(이)가 기뻐하고 있어요!`),
    ok: noir ? "확인" : "좋아요!",
  };
}
