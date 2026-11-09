import { getDB, newId } from "./index";
import type { Profile, Subject } from "./types";
import { SUBJECT_GROUPS, type GradeId } from "@/data/curriculum";
import type { PetSpecies } from "@/lib/game/pet";
import { toDateKey } from "@/lib/date";

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
    createdAt: now,
    updatedAt: now,
  }));
  await db.transaction("rw", db.profile, db.subjects, async () => {
    await db.profile.put(profile);
    if ((await db.subjects.count()) === 0) await db.subjects.bulkAdd(subjects);
  });
  return profile;
}

export async function updateProfile(patch: Partial<Omit<Profile, "id" | "createdAt">>) {
  await getDB().profile.update("me", { ...patch, updatedAt: Date.now() });
}

/** 경험치 지급. 이벤트 기록을 남겨 통계와 잔디에 쓴다. */
export async function grantXp(amount: number, reason: string, at = Date.now()) {
  const db = getDB();
  await db.transaction("rw", db.profile, db.xpEvents, async () => {
    const p = await db.profile.get("me");
    if (!p) throw new Error("profile not found");
    await db.profile.update("me", {
      totalXp: p.totalXp + amount,
      coins: p.coins + Math.floor(amount / 10),
      updatedAt: at,
    });
    await db.xpEvents.add({ id: newId(), at, date: toDateKey(new Date(at)), amount, reason });
  });
}
