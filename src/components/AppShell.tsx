"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { getDB } from "@/lib/db";
import { usePetState, useProfile } from "@/lib/hooks";
import { cn, Pill } from "./ui";
import { LevelUp } from "./LevelUp";
import { BadgeWatcher } from "./game/BadgeWatcher";
import { RetentionWatcher } from "./game/RetentionWatcher";
import { DialogHost } from "./Dialogs";
import { OfflineWarmup } from "./ServiceWorker";
import { TimerWatcher } from "./TimerWatcher";
import { Toaster } from "./Toaster";
import { formatClock, remaining, elapsed } from "@/lib/study/timer";
import { useMinuteTick, useNow, useTimerState } from "@/lib/timerStore";
import { toDateKey } from "@/lib/date";

const NAV = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/planner", label: "플래너", icon: "🗓️" },
  { href: "/review", label: "복습", icon: "🃏" },
  { href: "/ai", label: "AI 학습실", icon: "🤖" },
  { href: "/growth", label: "성장", icon: "🌱" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const profile = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (profile !== null) return;
    // 이전에 방문한 화면이 숨겨진 상태로 남아 있다가 다시 보일 때 값이 오래됐을 수 있어서
    // DB를 한 번 더 확인한 뒤에만 첫 실행 화면으로 보낸다.
    let cancelled = false;
    getDB()
      .profile.get("me")
      .then((p) => {
        if (!cancelled && !p) router.replace("/onboarding");
      });
    return () => {
      cancelled = true;
    };
  }, [profile, router]);

  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="font-display text-ink-soft">불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <TopBar />
      <DatedMain>{children}</DatedMain>
      <BottomNav />
      <TimerWatcher />
      <Toaster />
      <DialogHost />
      <LevelUp />
      <BadgeWatcher />
      <OfflineWarmup />
    </div>
  );
}

/** 자정이 지나면 화면을 다시 그려서 '오늘'이 새 날짜가 되게 한다 (프로필을 불러온 뒤에만 그려진다) */
function DatedMain({ children }: { children: ReactNode }) {
  useMinuteTick();
  const today = toDateKey();
  return (
    <>
      <RetentionWatcher today={today} />
      <main key={today} className="flex-1 px-4 pb-28 pt-2">
        {children}
      </main>
    </>
  );
}

function TopBar() {
  const state = usePetState();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-bg/90 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur">
      <Link href="/" className="font-display text-xl logo">
        홈스터디
      </Link>
      {state && (
        <div className="flex items-center gap-1.5">
          <MiniTimer />
          <Pill icon={<span aria-hidden>⭐</span>}>Lv.{state.level.level}</Pill>
          <Pill icon={<span aria-hidden>🔥</span>}>
            <span className="sr-only">연속 학습일</span>
            {state.streak.current}일
          </Pill>
          <Pill icon={<span aria-hidden>🪙</span>}>
            <span className="sr-only">코인</span>
            {state.profile.coins}
          </Pill>
          <Link href="/settings" aria-label="설정" className="ml-1 rounded-full p-1 text-xl">
            ⚙️
          </Link>
        </div>
      )}
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-xl border-t-2 border-line bg-surface px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2"
    >
      <ul className="grid grid-cols-5">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-xs transition-colors",
                  active ? "bg-bg-soft text-primary-deep font-display" : "text-ink-soft",
                )}
              >
                <span aria-hidden className={cn("text-xl transition-transform", active && "scale-110")}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MiniTimer() {
  const timer = useTimerState();
  const pathname = usePathname();
  const now = useNow(timer.phase !== "idle");
  if (timer.phase === "idle" || pathname === "/timer") return null;
  const ms = timer.mode === "free" && timer.phase === "focus" ? elapsed(timer, now) : remaining(timer, now);
  return (
    <Link href="/timer" className="font-display rounded-full bg-primary px-2.5 py-1 text-sm text-white tabular-nums">
      {timer.phase === "break" ? "☕" : "⏱️"} {formatClock(ms)}
    </Link>
  );
}
