"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DOW, Field, PageHeader, TextInput, formatDateKey, useSubjects } from "@/components/kit";
import { Button, Card, SectionTitle, cn } from "@/components/ui";
import { unitsForSubject } from "@/data/curriculum";
import { addDays, toDateKey } from "@/lib/date";
import { createExam, updateSubject } from "@/lib/db/study";
import type { Subject } from "@/lib/db/types";
import { generateExamPlan } from "@/lib/study/examPlan";

const TITLES = ["중간고사", "기말고사", "모의고사", "수행평가"];
const MINUTES = [60, 90, 120, 180, 240];

export default function NewExamPage() {
  const router = useRouter();
  const subjects = useSubjects();
  const today = toDateKey();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(addDays(today, 14));
  const [minutesPerDay, setMinutesPerDay] = useState(120);
  const [restDays, setRestDays] = useState<number[]>([]);
  const [ranges, setRanges] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const rangeList = useMemo(
    () => (subjects ?? []).map((s) => ({ subjectId: s.id, units: ranges[s.id] ?? [] })).filter((r) => r.units.length > 0),
    [subjects, ranges],
  );
  const plan = useMemo(
    () => generateExamPlan({ startDate: today, examDate: date, ranges: rangeList, minutesPerDay, restDays }),
    [today, date, rangeList, minutesPerDay, restDays],
  );
  const valid = title.trim() && date > today && !plan.problem;

  async function onSave() {
    if (!valid) return;
    setSaving(true);
    const { exam } = await createExam({ title, date, ranges: rangeList, minutesPerDay, restDays }, today);
    router.replace(`/planner/exam?id=${exam.id}`);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="📝 시험 계획 만들기" back="/planner" />

      <Card className="space-y-3">
        <Field label="시험 이름">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 2학기 기말고사" maxLength={30} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {TITLES.map((t) => (
            <button key={t} type="button" onClick={() => setTitle(t)} className="rounded-full border-2 border-line bg-surface-2 px-3 py-1 text-sm">
              {t}
            </button>
          ))}
        </div>
        <Field label="시험 날짜 (여러 날이면 첫날)">
          <TextInput type="date" value={date} min={addDays(today, 1)} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </Card>

      <section>
        <SectionTitle>공부할 시간</SectionTitle>
        <Card className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm text-ink-soft">하루 공부 시간</p>
            <div className="flex flex-wrap gap-2">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutesPerDay === m}
                  onClick={() => setMinutesPerDay(m)}
                  className={cn("font-display rounded-full border-2 px-3 py-1 text-sm", minutesPerDay === m ? "border-primary bg-primary text-white" : "border-line")}
                >
                  {m < 60 ? `${m}분` : `${m / 60}시간`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm text-ink-soft">쉬는 요일</p>
            <div className="grid grid-cols-7 gap-1">
              {DOW.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={restDays.includes(i)}
                  onClick={() => setRestDays(restDays.includes(i) ? restDays.filter((x) => x !== i) : [...restDays, i])}
                  className={cn("font-display rounded-xl border-2 py-1.5 text-sm", restDays.includes(i) ? "border-ink-soft bg-ink-soft text-bg" : "border-line")}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>시험 범위</SectionTitle>
        <div className="space-y-2">
          {subjects?.map((s) => (
            <RangePicker key={s.id} subject={s} value={ranges[s.id] ?? []} onChange={(units) => setRanges({ ...ranges, [s.id]: units })} />
          ))}
        </div>
      </section>

      <Card className="space-y-2 border-accent bg-accent/5">
        <p className="font-display">📋 계획 미리보기</p>
        {plan.problem === "no-units" ? (
          <p className="text-sm text-ink-soft">시험 범위 단원을 하나 이상 골라주세요.</p>
        ) : plan.problem === "no-days" ? (
          <p className="text-sm text-danger">시험 전까지 공부할 수 있는 날이 없어요. 날짜나 쉬는 요일을 바꿔주세요.</p>
        ) : (
          <>
            <p className="text-sm">
              {formatDateKey(today, false)}부터 {formatDateKey(addDays(date, -1), false)}까지 <b>{plan.studyDays.length}일</b> 동안
            </p>
            <ul className="space-y-1 text-sm">
              <li>📘 개념 학습 {plan.learnDays}일: 과목을 번갈아 가며 단원 공부 (교차 학습)</li>
              {plan.reviewDays > 0 && <li>🔁 범위 복습 {plan.reviewDays}일: 백지 복습과 오답 다시 풀기</li>}
              {plan.hasFinalDay && <li>🎯 시험 전날 총정리</li>}
            </ul>
            <p className="text-xs text-ink-soft">할 일 {plan.tasks.length}개가 플래너에 들어가요. 단원 공부를 끝내면 간격 복습도 자동으로 생겨요.</p>
          </>
        )}
      </Card>

      <Button size="lg" className="w-full" disabled={!valid || saving} onClick={onSave}>
        계획 만들기
      </Button>
    </div>
  );
}

function RangePicker({ subject, value, onChange }: { subject: Subject; value: string[]; onChange: (units: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const units = unitsForSubject(subject);

  async function addCustom() {
    const u = custom.trim();
    if (!u) return;
    if (!units.includes(u)) await updateSubject(subject.id, { customUnits: [...subject.customUnits, u] });
    if (!value.includes(u)) onChange([...value, u]);
    setCustom("");
  }

  const ordered = (next: string[]) => units.filter((u) => next.includes(u)).concat(next.filter((u) => !units.includes(u)));

  return (
    <Card className="p-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left">
        <span className="inline-block size-3 rounded-full" style={{ background: subject.color }} />
        <span className="font-display flex-1">{subject.name}</span>
        <span className="text-sm text-ink-soft">{value.length ? `${value.length}개 단원` : "범위 없음"}</span>
        <span aria-hidden className="text-ink-soft">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {units.length > 0 && (
            <div className="flex justify-end gap-3 text-xs">
              <button type="button" className="underline" onClick={() => onChange(units)}>
                모두 선택
              </button>
              <button type="button" className="underline" onClick={() => onChange([])}>
                모두 해제
              </button>
            </div>
          )}
          <ul className="space-y-1">
            {units.map((u) => (
              <li key={u}>
                <label className="flex items-center gap-2 rounded-xl px-1 py-1">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--primary)]"
                    checked={value.includes(u)}
                    onChange={(e) => onChange(ordered(e.target.checked ? [...value, u] : value.filter((x) => x !== u)))}
                  />
                  <span className="text-sm">{u}</span>
                </label>
              </li>
            ))}
          </ul>
          {units.length === 0 && <p className="text-sm text-ink-soft">등록된 단원이 없어요. 아래에 직접 입력하거나 설정 → 과목 관리에서 교육과정 과목을 연결하세요.</p>}
          <div className="flex gap-2">
            <TextInput
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addCustom();
                }
              }}
              placeholder="단원 직접 입력 (예: 교과서 3단원)"
              maxLength={40}
            />
            <Button type="button" size="sm" variant="ghost" onClick={addCustom}>
              추가
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
