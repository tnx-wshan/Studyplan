"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { Empty, Field, PageHeader, Sheet, SubjectChip, SubjectPicker, TextArea, TextInput, formatDateKey, useSubjectMap, useSubjects } from "@/components/kit";
import { StoredImage } from "@/components/StoredImage";
import { Button, Card, buttonStyles, cn } from "@/components/ui";
import { getDB } from "@/lib/db";
import { deleteWrongAnswer, updateWrongAnswer } from "@/lib/db/study";
import type { WrongAnswer } from "@/lib/db/types";
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
  const [editing, setEditing] = useState<WrongAnswer | null>(null);
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
                      <div className="flex justify-end gap-4">
                        <button type="button" className="underline" onClick={() => setEditing(w)}>
                          고치기
                        </button>
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
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="오답 고치기">
        {editing && <EditWrongForm key={editing.id} item={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function EditWrongForm({ item, onDone }: { item: WrongAnswer; onDone: () => void }) {
  const [question, setQuestion] = useState(item.question);
  const [myAnswer, setMyAnswer] = useState(item.myAnswer);
  const [correctAnswer, setCorrectAnswer] = useState(item.correctAnswer);
  const [reason, setReason] = useState(item.reason);
  const [note, setNote] = useState(item.note ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await updateWrongAnswer(item.id, { question: question.trim(), myAnswer: myAnswer.trim(), correctAnswer: correctAnswer.trim(), reason, note: note.trim() || undefined });
        onDone();
      }}
    >
      <Field label="문제 내용">
        <TextArea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="내가 쓴 답">
          <TextInput value={myAnswer} onChange={(e) => setMyAnswer(e.target.value)} maxLength={200} />
        </Field>
        <Field label="정답">
          <TextInput value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} maxLength={500} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(WRONG_REASONS) as WrongAnswer["reason"][]).map((k) => (
          <button key={k} type="button" aria-pressed={reason === k} onClick={() => setReason(k)} className={cn("font-display rounded-2xl border-2 py-2 text-sm", reason === k ? "border-primary bg-bg-soft" : "border-line")}>
            {WRONG_REASONS[k].icon} {WRONG_REASONS[k].label}
          </button>
        ))}
      </div>
      <Field label="메모">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </Field>
      <Button type="submit" className="w-full" disabled={!correctAnswer.trim()}>
        저장
      </Button>
    </form>
  );
}
