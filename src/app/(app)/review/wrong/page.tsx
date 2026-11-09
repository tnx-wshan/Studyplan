"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { Empty, PageHeader, SubjectChip, SubjectPicker, formatDateKey, useSubjectMap, useSubjects } from "@/components/kit";
import { StoredImage } from "@/components/StoredImage";
import { Card, buttonStyles, cn } from "@/components/ui";
import { getDB } from "@/lib/db";
import { deleteWrongAnswer } from "@/lib/db/study";
import { toDateKey } from "@/lib/date";
import { WRONG_REASONS } from "@/lib/study/wrongReasons";

type Filter = "due" | "active" | "mastered" | "all";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "due", label: "오늘 풀 것" },
  { id: "active", label: "진행 중" },
  { id: "mastered", label: "정복" },
  { id: "all", label: "전체" },
];

export default function WrongListPage() {
  const today = toDateKey();
  const subjects = useSubjects() ?? [];
  const subjectMap = useSubjectMap();
  const [filter, setFilter] = useState<Filter>("active");
  const [subjectId, setSubjectId] = useState<string>();
  const [openId, setOpenId] = useState<string>();
  const all = useLiveQuery(() => getDB().wrongAnswers.orderBy("nextRetry").toArray(), []);

  const items = (all ?? []).filter((w) => {
    if (subjectId && w.subjectId !== subjectId) return false;
    if (filter === "due") return !w.mastered && w.nextRetry <= today;
    if (filter === "active") return !w.mastered;
    if (filter === "mastered") return w.mastered;
    return true;
  });
  const dueCount = (all ?? []).filter((w) => !w.mastered && w.nextRetry <= today).length;
  const byReason = (all ?? []).reduce<Record<string, number>>((acc, w) => ({ ...acc, [w.reason]: (acc[w.reason] ?? 0) + 1 }), {});

  return (
    <div className="space-y-4">
      <PageHeader
        title="📝 오답노트"
        back="/review"
        action={
          <Link href="/review/wrong/new" className={buttonStyles("primary", "sm")}>
            + 기록
          </Link>
        }
      />

      {dueCount > 0 && (
        <Link href="/review/wrong/retry" className={buttonStyles("accent", "lg", "w-full")}>
          오늘 다시 풀 문제 {dueCount}개 풀기
        </Link>
      )}

      {all && all.length > 0 && (
        <Card className="flex flex-wrap gap-2 p-3 text-sm">
          <span className="text-ink-soft">틀린 이유</span>
          {Object.entries(WRONG_REASONS).map(([k, r]) => (
            <span key={k}>
              {r.icon} {r.label} <b className="font-display">{byReason[k] ?? 0}</b>
            </span>
          ))}
        </Card>
      )}

      <div className="flex gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn("font-display shrink-0 rounded-full border-2 px-3 py-1 text-sm", filter === f.id ? "border-ink bg-ink text-bg" : "border-line")}
          >
            {f.label}
          </button>
        ))}
      </div>
      <SubjectPicker subjects={subjects} value={subjectId} onChange={setSubjectId} allowNone noneLabel="전체" />

      {items.length === 0 ? (
        <Card>
          <Empty icon="🧹">{all?.length ? "조건에 맞는 문제가 없어요." : "틀린 문제를 기록하면 잊어버릴 때쯤 다시 풀 수 있게 알려줘요."}</Empty>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((w) => {
            const open = openId === w.id;
            const reason = WRONG_REASONS[w.reason];
            return (
              <li key={w.id}>
                <Card className="p-3">
                  <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? undefined : w.id)} className="w-full text-left">
                    <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <SubjectChip subject={w.subjectId ? subjectMap.get(w.subjectId) : undefined} />
                      {w.unitId && <span className="truncate">{w.unitId}</span>}
                      <span className="ml-auto shrink-0">{w.mastered ? "🏆 정복" : w.nextRetry <= today ? "오늘 다시 풀기" : `${formatDateKey(w.nextRetry, false)} 다시 풀기`}</span>
                    </div>
                    <p className={cn("mt-1", !open && "line-clamp-2")}>{w.question || "(사진 문제)"}</p>
                  </button>
                  {open && (
                    <div className="mt-3 space-y-2 text-sm">
                      {w.imageId && <StoredImage id={w.imageId} alt="문제 사진" className="max-h-80 w-full rounded-2xl object-contain" />}
                      <p>
                        <span className="text-ink-soft">내 답</span> <span className="text-danger line-through">{w.myAnswer || "-"}</span>
                      </p>
                      <p>
                        <span className="text-ink-soft">정답</span> <b className="text-success-deep">{w.correctAnswer || "-"}</b>
                      </p>
                      <p>
                        {reason.icon} {reason.label}
                        {w.note && <span className="text-ink-soft"> · {w.note}</span>}
                      </p>
                      <p className="text-xs text-ink-soft">
                        다시 푼 기록: {w.retries.length ? w.retries.map((r) => (r.correct ? "⭕" : "❌")).join(" ") : "아직 없음"} · 연속 정답 {w.streak}/3
                      </p>
                      <div className="flex justify-end">
                        <button type="button" className="text-danger underline" onClick={() => confirm("이 오답을 지울까요?") && deleteWrongAnswer(w.id)}>
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
