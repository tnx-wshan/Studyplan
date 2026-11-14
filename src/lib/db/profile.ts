import { getDB, newId, type HomeStudyDB } from "./index";
import type { Profile, Subject } from "./types";
import { SUBJECT_GROUPS, defaultCourseIds, type GradeId } from "@/data/curriculum";
import type { PetSpecies } from "@/lib/game/pet";
import { toDateKey } from "@/lib/date";
import { coinsForXp, levelFromXp } from "@/lib/game/level";
import { maxFreezes, rewardsForLevel } from "@/lib/game/rewards";
import { shopItem } from "@/data/shop";

export async function getProfile(): Promise<Profile | undefined> {
  return getDB().profile.get("me");
}

export interface OnboardingInput {
  nickname: string;
  grade: GradeId;
  goal: string;
  petSpecies: PetSpecies;
  petName: string;
}

/** 첫 실행 설정: 프로필과 기본 과목(국·영·수·사·과)을 만든다. */
export async function completeOnboarding(input: OnboardingInput): Promise<Profile> {
  const db = getDB();
  const now = Date.now();
  const profile: Profile = {
    id: "me",
    nickname: input.nickname.trim(),
    grade: input.grade,
    goal: input.goal.trim(),
    pet: { species: input.petSpecies, name: input.petName.trim() },
    totalXp: 0,
    coins: 0,
    theme: "system",
    onboardedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const subjects: Subject[] = SUBJECT_GROUPS.map((g) => ({
    id: newId(),
    name: g.label,
    group: g.id,
    color: g.color,
    courseIds: defaultCourseIds(input.grade, g.id),
    customUnits: [],
    createdAt: now,
    updatedAt: now,
  }));
  await db.transaction("rw", db.profile, db.subjects, async () => {
    await db.profile.put(profile);
    if ((await db.subjects.count()) === 0) await db.subjects.bulkAdd(subjects);
  });
  return profile;
}

export async function dismissLevelUp() {
  await getDB().profile.update("me", { levelUpFrom: undefined });
}

export async function updateProfile(patch: Partial<Omit<Profile, "id" | "createdAt">>) {
  await getDB().profile.update("me", { ...patch, updatedAt: Date.now() });
}

export type XpReason = "focus" | "task" | "card" | "wrong" | "quiz" | "method" | "reflection" | "exam" | "learn" | `quest:${string}` | "other";

/**
 * 레벨업 보상을 프로필에 적용한 값. 아직 받지 않은 레벨(rewardedLevel 다음 ~ level)의 보상을 모두 준다.
 * 코인, 보호권(보관 한도까지), 꾸미기 아이템(이미 있으면 그 값만큼 코인). 나머지(이야기·외형·칭호·지도·캐릭터·테두리)는 레벨로 저절로 열린다.
 */
export function applyLevelRewards(p: Profile, level: number): Partial<Profile> {
  const from = p.rewardedLevel ?? 0;
  if (level <= from) return {};
  let coins = p.coins;
  let freezes = p.freezes ?? 0;
  const owned = new Set(p.owned ?? []);
  for (let lv = from + 1; lv <= level; lv++) {
    for (const r of rewardsForLevel(lv)) {
      if (r.kind === "coins") coins += r.amount;
      if (r.kind === "freeze") freezes = Math.min(maxFreezes(lv), freezes + 1);
      if (r.kind === "item") {
        if (owned.has(r.itemId)) coins += shopItem(r.itemId)?.price ?? 0;
        else owned.add(r.itemId);
      }
    }
  }
  return { coins, freezes, owned: [...owned], rewardedLevel: level };
}

/** 경험치 지급. profile·xpEvents 테이블을 포함한 트랜잭션 안에서 호출해야 한다. 레벨이 오르면 보상도 준다 */
export async function addXpInTx(db: HomeStudyDB, amount: number, reason: XpReason, at = Date.now()) {
  const p = await db.profile.get("me");
  if (!p) throw new Error("profile not found");
  const before = levelFromXp(p.totalXp).level;
  const after = levelFromXp(p.totalXp + amount).level;
  const next = { ...p, coins: p.coins + coinsForXp(amount) };
  await db.profile.update("me", {
    totalXp: p.totalXp + amount,
    coins: next.coins,
    updatedAt: at,
    ...(after > before && p.levelUpFrom === undefined ? { levelUpFrom: before } : {}),
    ...applyLevelRewards(next, after),
  });
  await db.xpEvents.add({ id: newId(), at, date: toDateKey(new Date(at)), amount, reason });
}

/** 경험치 지급. 이벤트 기록을 남겨 통계와 잔디, 퀘스트 진행에 쓴다. */
export async function grantXp(amount: number, reason: XpReason, at = Date.now()) {
  const db = getDB();
  await db.transaction("rw", db.profile, db.xpEvents, () => addXpInTx(db, amount, reason, at));
}
