"use client";

import { useEffect } from "react";
import { recordStudySession } from "@/lib/db/study";
import { enqueue, focusId, tick, type CompletedFocus } from "@/lib/study/timer";
import { getTimer, setTimer } from "@/lib/timerStore";
import { toast } from "./Toaster";

let flushing = false;

/**
 * 대기 중인 집중 기록을 저장한다. 저장에 성공한 것만 대기열에서 뺀다.
 * 같은 구간은 같은 id라서 여러 번 불려도(다른 탭 포함) 한 번만 저장된다.
 */
export async function flushPendingFocus() {
  if (flushing) return;
  flushing = true;
  try {
    for (const c of getTimer().pending ?? []) {
      const saved = await recordStudySession(
        { startedAt: c.startedAt, endedAt: c.endedAt, focusMinutes: c.minutes, mode: c.mode, subjectId: c.subjectId, taskId: c.taskId },
        focusId(c),
      );
      const now = getTimer();
      setTimer({ ...now, pending: (now.pending ?? []).filter((p) => focusId(p) !== focusId(c)) });
      if (saved) toast(`집중 ${saved.focusMinutes}분 기록! +${saved.focusMinutes} XP`);
    }
  } catch {
    // 저장 실패: 대기열에 남겨두고 다음 확인 때 다시 시도
  } finally {
    flushing = false;
  }
}

/** 집중을 끝냈을 때: 먼저 대기열에 넣고(앱이 닫혀도 남도록) 저장한다 */
export async function saveFocus(c: CompletedFocus) {
  setTimer(enqueue(getTimer(), c));
  await flushPendingFocus();
}

function chime() {
  try {
    navigator.vibrate?.([200, 100, 200]);
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.25);
      o.stop(ctx.currentTime + i * 0.25 + 0.4);
    });
  } catch {}
}

function notify(text: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
      new Notification("홈스터디", { body: text, icon: "/icons/icon-192.png" });
    }
  } catch {}
}

/** 어느 화면에 있든 타이머가 끝나면 기록하고 알려준다 */
export function TimerWatcher() {
  useEffect(() => {
    const check = () => {
      const before = getTimer();
      const { state, completed } = tick(before, Date.now());
      if (state !== before) {
        // 상태 변경과 대기열 추가를 한 번에 저장
        setTimer(enqueue(state, completed));
        if (completed) {
          chime();
          notify(`집중 ${completed.minutes}분 완료! 잠깐 쉬어요.`);
        } else if (before.phase === "break" && state.phase === "idle") {
          chime();
          notify("휴식 끝! 다시 집중해 볼까요?");
          toast("휴식 끝! 다시 집중해 볼까요?");
        }
      }
      if (getTimer().pending?.length) void flushPendingFocus();
    };
    check();
    const id = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return null;
}
