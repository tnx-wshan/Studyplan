import type { UiStyleName } from "@/lib/game/companion";

/**
 * 대표 캐릭터. 테마마다 한 명이고, 처음엔 테마의 대표 캐릭터로 시작한다.
 * 레벨 10이 되면 다른 테마의 캐릭터도 고를 수 있다.
 *
 * 그림은 public/characters/<id>/ 에 넣는다 (docs/캐릭터와-성장-제안.md):
 *   stage-0.png, stage-4.png, stage-8.png, stage-12.png, stage-16.png, stage-20.png  (성장 단계 전신, 투명 배경)
 *   face-basic.png, face-happy.png, face-cheer.png, face-surprised.png, face-tired.png (표정, 선택)
 *   key.png (캐릭터 고르기 대표 그림, 선택), scene-20.jpg (레벨 20 기념 장면, 선택)
 * 그림이 없으면 지금의 동료 그림(SVG)을 대신 보여준다.
 */
export type CharacterId = "ren" | "moa";

export interface CharacterDef {
  id: CharacterId;
  /** 이 캐릭터의 원래 테마 (그림이 없을 때 대신 그릴 동료 모양) */
  theme: UiStyleName;
  name: string;
  /** 한 줄 소개 */
  role: string;
  description: string;
  /** 성장 단계(0~5)별 칭호: Lv 0·4·8·12·16·20 */
  titles: [string, string, string, string, string, string];
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: "ren",
    theme: "noir",
    name: "렌",
    role: "잊는 도시의 견습 기록관",
    description: "기억이 사라져 가는 도시의 마지막 견습 기록관. 네가 공부한 것을 기록으로 지켜 서고를 되살린다. 말수는 적지만 계약자를 믿는다.",
    titles: ["견습 기록관", "하급 기록관", "정식 기록관", "선임 기록관", "수석 기록관", "기억의 수호자"],
  },
  {
    id: "moa",
    theme: "cute",
    name: "모아",
    role: "별빛 도서관의 견습 마법 학생",
    description: "공부한 만큼 책 속 별이 깨어나는 별빛 도서관의 견습생. 구름 동료 솜솜과 함께 다녀요. 늘 밝게 응원해요.",
    titles: ["별빛 견습생", "별빛 수습 마법사", "별빛 마법사", "도서관 사서", "선임 사서", "별의 대사서"],
  },
];

/** 성장 단계 그림이 바뀌는 레벨 */
export const GROWTH_LEVELS = [0, 4, 8, 12, 16, 20] as const;

/** 레벨 → 성장 단계 0~5 */
export function growthStage(level: number): number {
  return Math.max(0, Math.min(5, Math.floor(level / 4)));
}

export function characterById(id: string | undefined): CharacterDef | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

/** 테마의 대표 캐릭터 */
export function defaultCharacter(style: UiStyleName): CharacterDef {
  return CHARACTERS.find((c) => c.theme === style) ?? CHARACTERS[0];
}

/** 다른 테마의 캐릭터를 고를 수 있는 레벨 */
export const SECOND_CHARACTER_LEVEL = 10;

/** 고를 수 있는 캐릭터인지: 자기 테마의 대표는 처음부터, 다른 테마는 레벨 10부터 */
export function canUseCharacter(c: CharacterDef, style: UiStyleName, level: number): boolean {
  return c.theme === style || level >= SECOND_CHARACTER_LEVEL;
}

/** 지금 보여줄 캐릭터: 고른 캐릭터를 쓸 수 있으면 그것, 아니면 테마의 대표 */
export function activeCharacter(chosen: string | undefined, style: UiStyleName, level: number): CharacterDef {
  const c = characterById(chosen);
  return c && canUseCharacter(c, style, level) ? c : defaultCharacter(style);
}

export const stageImage = (id: CharacterId, stage: number) => `stage-${GROWTH_LEVELS[Math.max(0, Math.min(5, stage))]}.png`;
