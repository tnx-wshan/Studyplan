"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge, Td, Th } from "@/components/admin/AdminShell";
import { Field, Select, TextArea, TextInput } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { Button, Card, SectionTitle, cn } from "@/components/ui";
import { GRADES, SUBJECT_GROUPS, coursesFor, type GradeId, type SubjectGroup } from "@/data/curriculum";
import { agentPrompt } from "@/data/learn/agentPrompt";
import { adminApi } from "@/lib/admin/client";
import { readImportText } from "@/lib/learn/import";
import { courseName } from "@/lib/learn/names";
import type { CourseOutline } from "@/lib/learn/types";

interface Row {
  where: string;
  grade: string;
  subject: string;
  section: string;
  title: string;
  status: "ok" | "duplicate" | "error";
  problems: string[];
  steps: number;
  questions: number;
  figures: number;
  newSection: boolean;
  unitId?: string;
}

interface Result {
  rows: Row[];
  problems: string[];
  applied: boolean;
  added: number;
  sectionsAdded: number;
}

const STATUS: Record<Row["status"], [string, string]> = {
  ok: ["넣을 수 있음", "border-success text-success-deep"],
  duplicate: ["이미 있음", "border-line text-ink-soft"],
  error: ["문제 있음", "border-danger text-danger"],
};

export default function AdminLearnImport() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publish, setPublish] = useState(false);

  const ready = result && !result.applied ? result.rows.filter((r) => r.status === "ok").length : 0;

  async function send(apply: boolean) {
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi<Result>("/api/admin/learn/import", { method: "POST", body: { text, apply, publish } });
      setResult(r);
      if (apply) toast(`유닛 ${r.added}개를 넣었어요${publish ? " (공개)" : " (초안)"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했어요.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  /** 여러 파일을 고르면 하나의 배열로 합친다 */
  async function onFiles(files: File[]) {
    const parts = await Promise.all(files.map((f) => f.text()));
    if (parts.length === 1) return setText(parts[0]);
    const all: unknown[] = [];
    for (const [i, p] of parts.entries()) {
      const r = readImportText(p);
      if (r.error) return setError(`${files[i].name}: ${r.error}`);
      all.push(...(Array.isArray(r.data) ? r.data : [r.data]));
    }
    setText(JSON.stringify(all, null, 2));
    setResult(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/learn" className="text-sm underline">
          ‹ 학습 과정
        </Link>
        <h1 className="font-display flex-1 text-2xl">유닛 일괄 넣기</h1>
      </div>
      <p className="text-sm text-ink-soft">
        다른 AI 에이전트로 만든 학습 유닛(JSON)을 한꺼번에 넣어요. 먼저 <b>검사</b>로 결과를 확인하고 넣으세요. 섹션이 없으면 새로 만들고, 문제가 있는 유닛과 이미 있는 유닛은 건너뛰어요. 넣은 유닛은 기본으로 초안이라 학습 과정에서 확인한 뒤 공개해요.
      </p>

      <PromptMaker />

      <section className="space-y-3">
        <SectionTitle>2. 만든 JSON 넣기</SectionTitle>
        <Card className="space-y-3">
          <Field label="JSON 붙여 넣기 (코스 하나, 코스 여러 개의 배열 모두 돼요)">
            <TextArea
              rows={12}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
              className="font-mono text-xs"
              placeholder='{ "grade": "m1", "subject": "math", "section": "소인수분해", "units": [ ... ] }'
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-lg border-2 border-line px-3 py-1 text-sm">
              📂 JSON 파일 고르기 (여러 개 가능)
              <input
                type="file"
                accept=".json,application/json,text/plain"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = "";
                  if (files.length) void onFiles(files);
                }}
              />
            </label>
            <Button size="sm" disabled={busy || !text.trim()} onClick={() => send(false)}>
              {busy && !ready ? "검사하는 중…" : "검사하기"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="whitespace-pre-line text-sm text-danger">
              {error}
            </p>
          )}
        </Card>
      </section>

      {result && <ResultView result={result} />}

      {result && !result.applied && (
        <Card className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            넣으면서 바로 공개하기 (확인 없이 학생에게 보여요)
          </label>
          <Button variant="success" disabled={busy || ready === 0} onClick={() => send(true)} className="ml-auto">
            {busy ? "넣는 중…" : `유닛 ${ready}개 넣기`}
          </Button>
        </Card>
      )}
      {result?.applied && (
        <Card className="space-y-1 text-sm">
          <p className="font-display">
            유닛 {result.added}개를 넣었어요{result.sectionsAdded ? `, 섹션 ${result.sectionsAdded}개를 새로 만들었어요` : ""}.
          </p>
          <p className="text-ink-soft">{publish ? "바로 공개했어요." : "초안으로 넣었어요. 학습 과정에서 열어 확인한 뒤 공개하세요."}</p>
          <Link href="/admin/learn" className="underline">
            학습 과정으로 가기
          </Link>
        </Card>
      )}
    </div>
  );
}

function ResultView({ result }: { result: Result }) {
  const counts = { ok: 0, duplicate: 0, error: 0 };
  for (const r of result.rows) counts[r.status]++;
  return (
    <section className="space-y-2">
      <SectionTitle>{result.applied ? "넣은 결과" : "검사 결과"}</SectionTitle>
      <p className="text-sm" role="status">
        {result.applied ? "넣음" : "넣을 수 있음"} {counts.ok}개 · 이미 있음 {counts.duplicate}개 · 문제 있음 {counts.error}개
      </p>
      {result.problems.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-danger">
          {result.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {result.rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border-2 border-line bg-surface" tabIndex={0} role="region" aria-label="결과 표 (옆으로 밀어서 보기)">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <Th>#</Th>
                <Th>코스 · 섹션</Th>
                <Th>유닛</Th>
                <Th>단계 · 문제 · 그림</Th>
                <Th>결과</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.where}>
                  <Td className="text-ink-soft">{r.where}</Td>
                  <Td>
                    {r.grade && r.subject ? courseName(r.grade, r.subject) : "-"}
                    <span className="block text-xs text-ink-soft">
                      {r.section || "-"}
                      {r.newSection && r.status === "ok" && " (새 섹션)"}
                    </span>
                  </Td>
                  <Td>
                    {r.unitId ? (
                      <Link href={`/admin/learn/unit?id=${r.unitId}`} className="underline">
                        {r.title}
                      </Link>
                    ) : (
                      r.title || "-"
                    )}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {r.steps} · {r.questions} · {r.figures}
                  </Td>
                  <Td>
                    {r.unitId ? <StatusBadge status="draft" /> : <span className={cn("inline-block whitespace-nowrap rounded-full border-2 px-2 py-0.5 text-xs", STATUS[r.status][1])}>{STATUS[r.status][0]}</span>}
                    {r.problems.length > 0 && (
                      <ul className="mt-1 list-disc pl-4 text-xs text-ink-soft">
                        {r.problems.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** 학년·과목·섹션을 고르면 AI 에이전트에게 줄 지시문을 만든다 (이미 있는 유닛과 겹치지 않게) */
function PromptMaker() {
  const [grade, setGrade] = useState<GradeId>("m1");
  const [subject, setSubject] = useState<SubjectGroup>("math");
  const [section, setSection] = useState("");
  const [count, setCount] = useState("10");
  const [outline, setOutline] = useState<CourseOutline | null>(null);

  useEffect(() => {
    adminApi<{ outline: CourseOutline }>(`/api/admin/learn?grade=${grade}&subject=${subject}`).then(
      (r) => setOutline(r.outline),
      () => setOutline(null),
    );
  }, [grade, subject]);

  // 섹션 후보: 이미 있는 섹션 + 교육과정 대표 단원
  const sections = useMemo(() => [...new Set([...(outline?.sections.map((s) => s.title) ?? []), ...coursesFor(grade, subject).flatMap((c) => c.units)])], [outline, grade, subject]);
  const chosen = section && sections.includes(section) ? section : (sections[0] ?? "");
  const existing = outline?.sections.find((s) => s.title === chosen)?.units.map((u) => u.title) ?? [];
  const prompt = chosen ? agentPrompt({ grade, subject, section: chosen, count: Math.max(1, Math.min(50, Number(count) || 10)), existing }) : "";

  return (
    <section className="space-y-3">
      <SectionTitle>1. AI 에이전트에게 줄 지시문 만들기</SectionTitle>
      <Card className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label="학년">
            <Select value={grade} onChange={(e) => setGrade(e.target.value as GradeId)}>
              {GRADES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="과목">
            <Select value={subject} onChange={(e) => setSubject(e.target.value as SubjectGroup)}>
              {SUBJECT_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="섹션">
            <Select value={chosen} onChange={(e) => setSection(e.target.value)}>
              {sections.length === 0 && <option value="">교육과정 단원이 없어요</option>}
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="유닛 수">
            <TextInput type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
        </div>
        {sections.length === 0 && <p className="text-xs text-ink-soft">이 과목은 교육과정 단원이 비어 있어요. 학습 과정에서 섹션을 먼저 만들면 여기에 나와요.</p>}
        {prompt && (
          <>
            <TextArea aria-label="AI 에이전트용 지시문" readOnly rows={10} value={prompt} className="font-mono text-xs" />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(prompt);
                    toast("지시문을 복사했어요.");
                  } catch {
                    toast("복사하지 못했어요. 칸을 눌러 직접 복사해 주세요.");
                  }
                }}
              >
                📋 지시문 복사
              </Button>
              <span className="text-xs text-ink-soft">
                {courseName(grade, subject)} · {chosen}
                {existing.length ? ` · 이미 있는 유닛 ${existing.length}개는 겹치지 않게 넣었어요` : ""}
              </span>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
