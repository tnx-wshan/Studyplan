import { SECOND_CHARACTER_LEVEL } from "@/data/characters";
import { MAX_LEVEL } from "./level";

/**
 * 레벨업 보상 (docs/캐릭터와-성장-제안.md 5장). 공부 기능은 레벨로 잠그지 않는다.
 *  - 매 레벨: 이야기 한 편 + 코인 (레벨 × 50)
 *  - 2·6·10·14·18: 연속 기록 보호권 +1 (보관 한도: 레벨 10부터 3개)
 *  - 3·7·11·15·19: 꾸미기 아이템 1개 (이미 가졌으면 그 값만큼 코인)
 *  - 4·8·12·16·20: 캐릭터 외형 성장 + 칭호
 *  - 5·15: 학습 지도 꾸미기
 *  - 10: 두 번째 캐릭터 + 은빛 프로필 테두리
 *  - 20: 최종 외형 + 외전 이야기 + 금빛 테두리 + 기념 장면
 */
export type MapSkin = "basic" | "lantern" | "gilded";
export type CardFrame = "silver" | "gold";

export type LevelReward =
  | { kind: "story" }
  | { kind: "coins"; amount: number }
  | { kind: "freeze" }
  | { kind: "item"; itemId: string }
  | { kind: "growth"; stage: number }
  | { kind: "mapSkin"; skin: MapSkin }
  | { kind: "character" }
  | { kind: "frame"; frame: CardFrame }
  | { kind: "sideStory" }
  | { kind: "scene" };

/** 꾸미기 보상: 상점 물건을 레벨 보상으로 준다 */
export const ITEM_REWARDS: Record<number, string> = { 3: "glasses", 7: "night", 11: "scarf", 15: "library", 19: "halo" };
export const FREEZE_LEVELS = [2, 6, 10, 14, 18];
export const MAP_SKIN_LEVELS: Record<MapSkin, number> = { basic: 0, lantern: 5, gilded: 15 };

export function rewardsForLevel(level: number): LevelReward[] {
  if (level < 1 || level > MAX_LEVEL) return [];
  const r: LevelReward[] = [{ kind: "story" }, { kind: "coins", amount: level * 50 }];
  if (FREEZE_LEVELS.includes(level)) r.push({ kind: "freeze" });
  if (ITEM_REWARDS[level]) r.push({ kind: "item", itemId: ITEM_REWARDS[level] });
  if (level % 4 === 0) r.push({ kind: "growth", stage: level / 4 });
  if (level === MAP_SKIN_LEVELS.lantern) r.push({ kind: "mapSkin", skin: "lantern" });
  if (level === MAP_SKIN_LEVELS.gilded) r.push({ kind: "mapSkin", skin: "gilded" });
  if (level === SECOND_CHARACTER_LEVEL) r.push({ kind: "character" }, { kind: "frame", frame: "silver" });
  if (level === MAX_LEVEL) r.push({ kind: "sideStory" }, { kind: "frame", frame: "gold" }, { kind: "scene" });
  return r;
}

/** 연속 기록 보호권 보관 한도 */
export function maxFreezes(level: number): number {
  return level >= SECOND_CHARACTER_LEVEL ? 3 : 2;
}

/** 레벨로 받은 프로필 테두리 (가장 좋은 것) */
export function cardFrame(level: number): CardFrame | null {
  return level >= MAX_LEVEL ? "gold" : level >= SECOND_CHARACTER_LEVEL ? "silver" : null;
}

export function mapSkinUnlocked(skin: MapSkin, level: number): boolean {
  return level >= MAP_SKIN_LEVELS[skin];
}

export const MAP_SKIN_NAMES: Record<MapSkin, { noir: string; cute: string }> = {
  basic: { noir: "기본 길", cute: "기본 길" },
  lantern: { noir: "등불 길", cute: "별빛 길" },
  gilded: { noir: "황동 길", cute: "무지개 길" },
};
