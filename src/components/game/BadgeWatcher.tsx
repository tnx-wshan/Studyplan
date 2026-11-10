"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { toast } from "../Toaster";
import { useUiStyle } from "../ThemeSync";
import { getDB } from "@/lib/db";
import { syncBadges } from "@/lib/db/game";
import { badgeById } from "@/lib/game/achievements";
import { toDateKey } from "@/lib/date";
import { reportStudied } from "@/lib/push/client";

/** 기록이 바뀔 때마다 새로 달성한 업적이 있는지 확인하고 알려준다 */
export function BadgeWatcher() {
  const style = useUiStyle();
  // 경험치 기록과 집중 기록 수가 바뀌면 다시 확인
  const signal = useLiveQuery(async () => {
    const db = getDB();
    const [xp, sessions, profile] = await Promise.all([db.xpEvents.count(), db.studySessions.count(), db.profile.get("me")]);
    const today = toDateKey();
    const studiedToday = (await db.xpEvents.where("date").equals(today).count()) > 0;
    return { key: `${xp}:${sessions}:${profile?.totalXp ?? 0}`, studiedToday, today };
  }, []);

  // 오늘 공부했으면 서버에 알려서 '연속 기록' 알림을 보내지 않게 한다
  useEffect(() => {
    if (signal?.studiedToday) void reportStudied(signal.today);
  }, [signal?.studiedToday, signal?.today]);

  useEffect(() => {
    if (!signal?.key) return;
    let cancelled = false;
    void syncBadges().then((fresh) => {
      if (cancelled || fresh.length === 0) return;
      const names = fresh.map((id) => badgeById(id)).filter((b) => !!b).map((b) => (style === "noir" ? b.noirName : b.name));
      toast(`${style === "noir" ? "업적 기록" : "🏆 업적 달성"}: ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` 외 ${names.length - 2}개` : ""}`);
    });
    return () => {
      cancelled = true;
    };
  }, [signal?.key, style]);
  return null;
}
