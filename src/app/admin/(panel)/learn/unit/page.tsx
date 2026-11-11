"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/admin/AdminShell";
import { ImageTextArea } from "@/components/admin/ImageTextArea";
import { LessonPreview } from "@/components/admin/LessonPreview";
import type { PlayerUnit } from "@/components/learn/LessonPlayer";
import { askConfirm } from "@/components/Dialogs";
import { Field, Select, TextArea, TextInput } from "@/components/kit";
import { Markdown } from "@/components/Markdown";
import { toast } from "@/components/Toaster";
import { Button, Card, cn } from "@/components/ui";
import { adminApi, formatTime } from "@/lib/admin/client";
import { sanitizeSteps } from "@/lib/learn/check";
import { courseName } from "@/lib/learn/names";
import { STEP_LABELS, type CourseOutline, type LearnSection, type LearnUnit, type Step, type StepType } from "@/lib/learn/types";

type Unit = LearnUnit & { section: LearnSection };

const BLANK: Record<StepType, Step> = {
  summary: { type: "summary", title: "", body: "", points: [] },
  choice: { type: "choice", prompt: "", choices: ["", "", "", ""], answer: "", explanation: "" },
  short: { type: "short", prompt: "", answers: [""], explanation: "" },
  blank: { type: "blank", prompt: "빈칸에 알맞은 말을 고르세요.", text: "", distractors: [], explanation: "" },
  puzzle: { type: "puzzle", prompt: "", answer: "", decoys: "", explanation: "" },
};

const lines = (v: string) => v.split("\n");
const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);

export default function AdminUnitPage() {
  return (
    <Suspense fallback={null}>
      <UnitEditor />
    </Suspense>
  );
}

function UnitEditor() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [sections, setSections] = useState<CourseOutline["sections"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [json, setJson] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewUnit, setPreviewUnit] = useState<PlayerUnit | null>(null);

  const load = useCallback(
    () =>
      adminApi<{ unit: Unit }>(`/api/admin/learn/unit?id=${encodeURIComponent(id)}`)
        .then((r) => {
          setUnit(r.unit);
          return adminApi<{ outline: CourseOutline }>(`/api/admin/learn?grade=${r.unit.section.grade}&subject=${r.unit.section.subject}`);
        })
        .then(
          (o) => setSections(o.outline.sections),
          (e: Error) => setError(e.message),
        ),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p role="alert" className="text-danger">{error}</p>;
  if (!unit) return <p className="text-ink-soft">불러오는 중…</p>;

  const set = (patch: Partial<Unit>) => setUnit({ ...unit, ...patch });
  const setStep = (i: number, step: Step) => set({ steps: unit.steps.map((s, j) => (j === i ? step : s)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= unit.steps.length) return;
    const steps = [...unit.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    set({ steps });
  };

  /** 고치는 중인 내용(저장 전)으로 학생 화면을 띄운다. 잘못된 단계가 있으면 이유를 먼저 보여준다 */
  function startPreview() {
    let steps: unknown = unit!.steps;
    if (json !== null) {
      try {
        steps = JSON.parse(json);
      } catch {
        setProblems(["JSON 형식이 올바르지 않아요."]);
        return;
      }
    }
    const check = sanitizeSteps(steps);
    if (check.problems.length || check.steps.length === 0) {
      setProblems(check.problems.length ? check.problems : ["단계가 하나 이상 있어야 해요."]);
      return;
    }
    setProblems([]);
    setPreviewUnit({ id: unit!.id, title: unit!.title, steps: check.steps, section: unit!.section });
  }

  async function save(status = unit!.status) {
    let steps: unknown = unit!.steps;
    if (json !== null) {
      try {
        steps = JSON.parse(json);
      } catch {
        setProblems(["JSON 형식이 올바르지 않아요."]);
        return;
      }
    }
    const check = sanitizeSteps(steps);
    if (check.problems.length) {
      setProblems(check.problems);
      return;
    }
    setSaving(true);
    try {
      await adminApi("/api/admin/learn/unit", { method: "PUT", body: { id: unit!.id, title: unit!.title, steps, status, sectionId: unit!.sectionId } });
      setProblems([]);
      setJson(null);
      toast(status === "published" ? "저장했어요. 학생의 학습 탭에 보여요." : "저장했어요 (초안).");
      await load();
    } catch (e) {
      setProblems((e instanceof Error ? e.message : "저장하지 못했어요.").split("\n"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/learn" className="text-sm underline">
          ‹ 학습 과정
        </Link>
        <h1 className="font-display flex-1 text-2xl">유닛 고치기</h1>
        <StatusBadge status={unit.status} />
      </div>
      <p className="text-xs text-ink-soft">
        {courseName(unit.section.grade, unit.section.subject)} · 예상 {unit.minutes}분 · 마지막 저장 {formatTime(unit.updatedAt)}
        {unit.sourceIds.length > 0 && ` · 자료 ${unit.sourceIds.length}개로 만듦`}
      </p>

      <Card className="grid gap-3 md:grid-cols-2">
        <Field label="유닛 이름">
          <TextInput value={unit.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="섹션">
          <Select value={unit.sectionId} onChange={(e) => set({ sectionId: e.target.value })}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-display flex-1 text-lg">단계 {unit.steps.length}개</h2>
        <button type="button" className="mr-3 text-sm underline" onClick={startPreview}>
          ▶ 미리 풀기
        </button>
        <button type="button" className="text-sm underline" onClick={() => setJson(json === null ? JSON.stringify(unit.steps, null, 2) : null)}>
          {json === null ? "JSON으로 고치기" : "화면에서 고치기"}
        </button>
      </div>

      {json !== null ? (
        <Card className="space-y-2">
          <p className="text-xs text-ink-soft">여러 유닛을 한꺼번에 옮겨 올 때 편해요. 종류(type): summary · choice · short · blank · puzzle</p>
          <TextArea aria-label="단계 JSON" rows={24} value={json} onChange={(e) => setJson(e.target.value)} className="font-mono text-xs" />
        </Card>
      ) : (
        <ol className="space-y-3">
          {unit.steps.map((s, i) => (
            <li key={i}>
              <StepEditor
                index={i}
                step={s}
                onChange={(st) => setStep(i, st)}
                onMove={(d) => move(i, d)}
                onRemove={() => set({ steps: unit.steps.filter((_, j) => j !== i) })}
              />
            </li>
          ))}
        </ol>
      )}

      {json === null && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STEP_LABELS) as StepType[]).map((t) => (
            <Button key={t} size="sm" variant="ghost" onClick={() => set({ steps: [...unit.steps, structuredClone(BLANK[t])] })}>
              + {STEP_LABELS[t]}
            </Button>
          ))}
        </div>
      )}

      {problems.length > 0 && (
        <Card role="alert" className="border-danger text-sm text-danger">
          <p className="font-display">저장하지 못했어요</p>
          <ul className="list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="sticky bottom-3 flex flex-wrap gap-2">
        <Button variant="accent" onClick={startPreview}>
          ▶ 학생 화면으로 풀어 보기
        </Button>
        <Button disabled={saving} onClick={() => save()}>
          저장
        </Button>
        {unit.status === "draft" ? (
          <Button variant="success" disabled={saving} onClick={() => save("published")}>
            저장하고 공개
          </Button>
        ) : (
          <Button variant="ghost" disabled={saving} onClick={() => save("draft")}>
            초안으로 내리기
          </Button>
        )}
        <Button
          variant="ghost"
          className="text-danger"
          onClick={async () => {
            if (!(await askConfirm("이 유닛을 지울까요? 학생 진도 기록은 기기에 남지만 유닛은 사라져요.", { confirmLabel: "지우기", danger: true }))) return;
            await adminApi(`/api/admin/learn/unit?id=${unit.id}`, { method: "DELETE" });
            router.push("/admin/learn");
          }}
        >
          지우기
        </Button>
      </div>
      <LessonPreview unit={previewUnit} onClose={() => setPreviewUnit(null)} />
    </div>
  );
}

function StepEditor({ index, step, onChange, onMove, onRemove }: { index: number; step: Step; onChange: (s: Step) => void; onMove: (d: -1 | 1) => void; onRemove: () => void }) {
  const [preview, setPreview] = useState(false);
  const head = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-display">
        {index + 1}. {STEP_LABELS[step.type]}
      </span>
      <button type="button" className="text-xs underline" onClick={() => setPreview(!preview)}>
        {preview ? "고치기" : "미리 보기"}
      </button>
      <span className="ml-auto flex gap-1">
        <SmallBtn label={`${index + 1}번 위로`} onClick={() => onMove(-1)}>
          ↑
        </SmallBtn>
        <SmallBtn label={`${index + 1}번 아래로`} onClick={() => onMove(1)}>
          ↓
        </SmallBtn>
        <SmallBtn label={`${index + 1}번 빼기`} onClick={onRemove}>
          ✕
        </SmallBtn>
      </span>
    </div>
  );

  if (preview) {
    const text = step.type === "summary" ? `## ${step.title}\n\n${step.body}` : step.type === "blank" ? `${step.prompt}\n\n${step.text.replace(/\[\[([^\]]+)\]\]/g, "**[$1]**")}` : step.prompt;
    return (
      <Card className="space-y-2">
        {head}
        <Markdown>{text}</Markdown>
        {step.type === "choice" && <p className="text-sm">보기: {step.choices.join(" / ")} · 정답 {step.answer}</p>}
      </Card>
    );
  }

  return (
    <Card className={cn("space-y-2", step.type === "summary" && "border-xp")}>
      {head}
      {step.type === "summary" && (
        <>
          <Field label="제목">
            <TextInput value={step.title} onChange={(e) => onChange({ ...step, title: e.target.value })} />
          </Field>
          <ImageTextArea label="핵심 정리 (마크다운, 수식은 $...$, 그림 가능) — 휴대폰에서 30초 안에 읽을 만큼" rows={6} value={step.body} onChange={(body) => onChange({ ...step, body })} className="font-mono text-sm" />
          <Field label="꼭 기억할 점 (한 줄에 하나)">
            <TextArea value={step.points.join("\n")} onChange={(e) => onChange({ ...step, points: lines(e.target.value) })} />
          </Field>
        </>
      )}
      {step.type !== "summary" && (
        <ImageTextArea label={step.type === "puzzle" ? "뜻풀이 (힌트)" : "문제 (그림을 넣으면 문제 아래에 보여요)"} value={step.prompt} onChange={(prompt) => onChange({ ...step, prompt })} />
      )}
      {step.type === "choice" && (
        <>
          <Field label="보기 (한 줄에 하나)">
            <TextArea rows={4} value={step.choices.join("\n")} onChange={(e) => onChange({ ...step, choices: lines(e.target.value) })} />
          </Field>
          <Field label="정답">
            <Select value={step.answer} onChange={(e) => onChange({ ...step, answer: e.target.value })}>
              <option value="">고르세요</option>
              {clean(step.choices).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}
      {step.type === "short" && (
        <>
          <Field label="정답 (한 줄에 하나, 모두 정답으로 인정. 띄어쓰기·x²/x^2·×/* 차이는 자동으로 같게 봐요)">
            <TextArea value={step.answers.join("\n")} onChange={(e) => onChange({ ...step, answers: lines(e.target.value) })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={!!step.math} onChange={(e) => onChange({ ...step, math: e.target.checked || undefined })} />
            수식 도구를 펼쳐서 보여주기
          </label>
        </>
      )}
      {step.type === "blank" && (
        <>
          <Field label="문장 (빈칸이 될 낱말을 [[ ]]로 감싸요. 예: 광합성은 [[엽록체]]에서 일어난다.)">
            <TextArea value={step.text} onChange={(e) => onChange({ ...step, text: e.target.value })} />
          </Field>
          <Field label="헷갈리게 섞을 낱말 (한 줄에 하나)">
            <TextArea value={step.distractors.join("\n")} onChange={(e) => onChange({ ...step, distractors: lines(e.target.value) })} />
          </Field>
        </>
      )}
      {step.type === "puzzle" && (
        <div className="grid gap-2 md:grid-cols-2">
          <Field label="정답 낱말 (2~10글자)">
            <TextInput value={step.answer} onChange={(e) => onChange({ ...step, answer: e.target.value })} />
          </Field>
          <Field label="섞어 넣을 글자 (예: 약배)">
            <TextInput value={step.decoys} maxLength={6} onChange={(e) => onChange({ ...step, decoys: e.target.value })} />
          </Field>
        </div>
      )}
      {step.type !== "summary" && (
        <ImageTextArea label="해설" value={step.explanation} onChange={(explanation) => onChange({ ...step, explanation })} />
      )}
    </Card>
  );
}

function SmallBtn({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="rounded-lg border-2 border-line px-2 text-sm">
      {children}
    </button>
  );
}
