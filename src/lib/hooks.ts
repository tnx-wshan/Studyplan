"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db";
import { daysBetween, toDateKey } from "@/lib/date";
import { computeStreak } from "@/lib/game/streak";
import { levelFromXp } from "@/lib/game/level";
import { moodFromDaysSince, stageForLevel, nextStage } from "@/lib/game/pet";

/** undefined = 아직 불러오는 중, null = 프로필 없음(첫 실행) */
export function useProfile() {
  return useLiveQuery(async () => (await getDB().profile.get("me")) ?? null, [], undefined);
}

/** 공부 기록(집중 세션 + 경험치 이벤트)이 있는 날짜들로 연속일·펫 기분을 계산한다. */
export function useStudyDays() {
  return useLiveQuery(
    async () => {
      const db = getDB();
      const [sessions, xp, profile] = await Promise.all([
        db.studySessions.orderBy("date").uniqueKeys(),
        db.xpEvents.orderBy("date").uniqueKeys(),
        db.profile.get("me"),
      ]);
      const days = new Set([...(sessions as string[]), ...(xp as string[])]);
      const today = toDateKey();
      const sorted = [...days].sort();
      const last = sorted.at(-1) ?? null;
      return {
        days,
        streak: computeStreak(days, today, profile?.frozenDays),
        frozenDays: new Set(profile?.frozenDays ?? []),
        daysSinceLast: last ? daysBetween(last, today) : null,
      };
    },
    [],
    undefined,
  );
}

export function usePetState() {
  const profile = useProfile();
  const study = useStudyDays();
  if (!profile || !study) return null;
  const level = levelFromXp(profile.totalXp);
  return {
    profile,
    level,
    stage: stageForLevel(level.level),
    next: nextStage(level.level),
    mood: moodFromDaysSince(study.daysSinceLast),
    streak: study.streak,
  };
}
