"use client";

import { useEffect, useRef, useState } from "react";
import { LessonPlayer, type PlayerUnit } from "../learn/LessonPlayer";
import { cn } from "../ui";

type Look = "noir" | "cute-light" | "cute-dark";
const LOOKS: { id: Look; label: string }[] = [
  { id: "noir", label: "누아르" },
  { id: "cute-light", label: "귀여운 · 밝게" },
  { id: "cute-dark", label: "귀여운 · 어둡게" },
];

/**
 * 관리 도구의 '학생 화면으로 풀어 보기'. 학생 학습 탭과 같은 부품(LessonPlayer)을 휴대폰 크기 틀 안에 띄운다.
 * 진도·경험치는 기록하지 않는다. 테마를 바꿔 볼 수 있고, 닫으면 관리 도구의 테마로 돌아간다.
 */
export function LessonPreview({ unit, onClose }: { unit: PlayerUnit | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [run, setRun] = useState(0);
  const [look, setLook] = useState<Look>("noir");
  const open = !!unit;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // 미리 보는 동안만 화면 테마를 바꾸고, 닫으면 원래대로
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const saved = { style: root.dataset.style, theme: root.dataset.theme };
    root.dataset.style = look === "noir" ? "noir" : "cute";
    root.dataset.theme = look === "cute-light" ? "light" : "dark";
    return () => {
      if (saved.style) root.dataset.style = saved.style;
      if (saved.theme) root.dataset.theme = saved.theme;
    };
  }, [open, look]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="학생 화면 미리 풀기"
      className="m-auto max-h-none max-w-none bg-transparent p-0 text-ink backdrop:bg-black/60"
    >
      {unit && (
        <div className="flex flex-col items-center gap-2 p-2">
          {/* 아래 관리 화면이 밝아도 읽히도록 어두운 바탕 위에 쓴다 */}
          <div className="flex w-[390px] max-w-[calc(100vw-1rem)] flex-wrap items-center gap-2 rounded-2xl bg-black/85 px-3 py-1.5">
            <p className="font-display flex-1 text-sm text-white">학생 화면 미리 풀기 · 기록되지 않아요</p>
            <button type="button" onClick={onClose} className="rounded-full bg-white/90 px-3 py-1 text-sm text-black">
              닫기
            </button>
          </div>
          <div className="flex w-[390px] max-w-[calc(100vw-1rem)] gap-1 rounded-full bg-black/85 p-1" role="radiogroup" aria-label="미리 볼 테마">
            {LOOKS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={look === l.id}
                onClick={() => setLook(l.id)}
                className={cn("flex-1 rounded-full px-2 py-1 text-xs", look === l.id ? "bg-white text-black" : "text-white")}
              >
                {l.label}
              </button>
            ))}
          </div>
          {/* 휴대폰 화면 크기 (390 × 최대 844) */}
          <div className="h-[min(844px,calc(100dvh-7rem))] w-[390px] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[28px] border-4 border-black bg-bg px-4 py-4 shadow-2xl">
            <LessonPlayer key={run} unit={unit} mode="preview" style={look === "noir" ? "noir" : "cute"} onExit={onClose} onRestart={() => setRun((n) => n + 1)} />
          </div>
        </div>
      )}
    </dialog>
  );
}
