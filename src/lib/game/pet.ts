export type PetSpecies = "cloud" | "sprout" | "flame";

export const PET_SPECIES: Record<
  PetSpecies,
  { label: string; description: string; color: string; accent: string }
> = {
  cloud: { label: "구름 펫", description: "느긋하지만 꾸준해요. 암기 과목을 좋아해요.", color: "#8ec5ff", accent: "#4f8fe8" },
  sprout: { label: "새싹 펫", description: "조금씩 자라는 걸 좋아해요. 매일 공부하면 쑥쑥!", color: "#9be39b", accent: "#3fae5a" },
  flame: { label: "불꽃 펫", description: "열정이 넘쳐요. 집중 타이머를 좋아해요.", color: "#ffb37a", accent: "#ec6a2c" },
};

export type PetStage = "egg" | "baby" | "child" | "teen" | "adult";

export const PET_STAGES: { stage: PetStage; label: string; minLevel: number }[] = [
  { stage: "egg", label: "알", minLevel: 1 },
  { stage: "baby", label: "아기", minLevel: 2 },
  { stage: "child", label: "어린이", minLevel: 5 },
  { stage: "teen", label: "청소년", minLevel: 10 },
  { stage: "adult", label: "어른", minLevel: 20 },
];

export function stageForLevel(level: number) {
  let found = PET_STAGES[0];
  for (const s of PET_STAGES) if (level >= s.minLevel) found = s;
  return found;
}

export function nextStage(level: number) {
  return PET_STAGES.find((s) => s.minLevel > level) ?? null;
}

export type PetMood = "excited" | "happy" | "sad" | "sleepy";

export const PET_MOOD_TEXT: Record<PetMood, string> = {
  excited: "오늘도 같이 공부해서 신나요!",
  happy: "오늘은 뭘 공부할까요?",
  sad: "보고 싶었어요… 조금만 같이 공부해요.",
  sleepy: "너무 오래 쉬어서 잠들었어요. 공부하면 깨어나요!",
};

/** 마지막 공부일로부터 지난 일수로 기분을 정한다. 기록이 없으면 기대에 찬 상태. */
export function moodFromDaysSince(daysSince: number | null): PetMood {
  if (daysSince === null) return "happy";
  if (daysSince <= 0) return "excited";
  if (daysSince === 1) return "happy";
  if (daysSince <= 3) return "sad";
  return "sleepy";
}
