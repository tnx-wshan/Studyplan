"use client";

import Link from "next/link";
import { useEffect, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db";
import type { Subject } from "@/lib/db/types";
import { cn } from "./ui";
import { SUBJECT_GROUPS, type SubjectGroup } from "@/data/curriculum";

const groupIndex = (g: SubjectGroup) => SUBJECT_GROUPS.findIndex((x) => x.id === g);

/** 과목 정렬: 만든 순서, 같으면 국·영·수·사·과 순 */
export function compareSubjects(a: Subject, b: Subject) {
  return a.createdAt - b.createdAt || groupIndex(a.group) - groupIndex(b.group);
}

export const fieldClass =
  "w-full rounded-2xl border-2 border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-accent";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldClass, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cn(fieldClass, "resize-y", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldClass, props.className)} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-ink-soft">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <Link href={back} aria-label="뒤로" className="-ml-1 rounded-full px-2 py-1 text-xl">
          ‹
        </Link>
      )}
      <h1 className="font-display flex-1 text-2xl">{title}</h1>
      {action}
    </div>
  );
}

/** 보관하지 않은 과목 목록 (생성 순) */
export function useSubjects() {
  return useLiveQuery(
    async () =>
      (await getDB().subjects.toArray())
        .filter((s) => !s.archived)
        .sort(compareSubjects),
    [],
    undefined,
  );
}

export function useSubjectMap() {
  const subjects = useLiveQuery(() => getDB().subjects.toArray(), [], undefined);
  return new Map((subjects ?? []).map((s) => [s.id, s]));
}

export function SubjectChip({ subject, className }: { subject?: Subject; className?: string }) {
  if (!subject) return null;
  return (
    <span
      className={cn("font-display inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs text-white", className)}
      style={{ background: subject.color }}
    >
      {subject.name}
    </span>
  );
}

export function SubjectPicker({
  subjects,
  value,
  onChange,
  allowNone,
  noneLabel = "없음",
}: {
  subjects: Subject[];
  value?: string;
  onChange: (id: string | undefined) => void;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="과목">
      {allowNone && (
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          onClick={() => onChange(undefined)}
          className={cn("font-display rounded-full border-2 px-3 py-1 text-sm", !value ? "border-ink bg-ink text-bg" : "border-line")}
        >
          {noneLabel}
        </button>
      )}
      {subjects.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={value === s.id}
          onClick={() => onChange(s.id)}
          className="font-display rounded-full border-2 px-3 py-1 text-sm"
          style={value === s.id ? { background: s.color, borderColor: s.color, color: "#fff" } : { borderColor: "var(--line)" }}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}

/** 아래에서 올라오는 시트 (모달 대화상자) */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-none bg-transparent p-0 backdrop:bg-black/40 sm:m-auto sm:max-w-lg"
    >
      {open && (
        <div className="mx-auto w-full max-w-xl rounded-t-3xl border-2 border-line bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] text-ink sm:rounded-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl">{title}</h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full px-2 text-2xl text-ink-soft">
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Empty({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-ink-soft">
      <span aria-hidden className="text-4xl">
        {icon}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function formatMinutes(min: number) {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export function formatDateKey(key: string, withDow = true) {
  const [, m, d] = key.split("-").map(Number);
  const dow = new Date(key + "T00:00:00").getDay();
  return withDow ? `${m}월 ${d}일 (${DOW[dow]})` : `${m}월 ${d}일`;
}
export { DOW };
