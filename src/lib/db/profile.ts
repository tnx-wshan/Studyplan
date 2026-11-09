import { getDB, newId, type HomeStudyDB } from "./index";
import type { Profile, Subject } from "./types";
import { SUBJECT_GROUPS, defaultCourseIds, type GradeId } from "@/data/curriculum";
import type { PetSpecies } from "@/lib/game/pet";
import { toDateKey } from "@/lib/date";
import { levelFromXp } from "@/lib/game/level";

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

export type XpReason = "focus" | "task" | "card" | "wrong" | `quest:${string}` | "other";

/** 경험치 지급. profile·xpEvents 테이블을 포함한 트랜잭션 안에서 호출해야 한다. */
export async function addXpInTx(db: HomeStudyDB, amount: number, reason: XpReason, at = Date.now()) {
  const p = await db.profile.get("me");
  if (!p) throw new Error("profile not found");
  const before = levelFromXp(p.totalXp).level;
  const after = levelFromXp(p.totalXp + amount).level;
  await db.profile.update("me", {
    totalXp: p.totalXp + amount,
    coins: p.coins + Math.floor(amount / 10),
    updatedAt: at,
    ...(after > before && p.levelUpFrom === undefined ? { levelUpFrom: before } : {}),
  });
  await db.xpEvents.add({ id: newId(), at, date: toDateKey(new Date(at)), amount, reason });
}

/** 경험치 지급. 이벤트 기록을 남겨 통계와 잔디, 퀘스트 진행에 쓴다. */
export async function grantXp(amount: number, reason: XpReason, at = Date.now()) {
  const db = getDB();
  await db.transaction("rw", db.profile, db.xpEvents, () => addXpInTx(db, amount, reason, at));
}
