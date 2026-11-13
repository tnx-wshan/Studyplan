"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge, Td, Th } from "@/components/admin/AdminShell";
import { Field, Select, TextArea, TextInput } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { Button, Card, SectionTitle, cn } from "@/components/ui";
import { GRADES, SUBJECT_GROUPS, coursesFor, type GradeId } from "@/data/curriculum";
import { agentPrompt } from "@/data/learn/agentPrompt";
import { adminApi } from "@/lib/admin/client";
import { mergeResults, packBatches, readBulkFiles, type BulkFile, type ImportResult, type ImportRow } from "@/lib/learn/bulk";
import { courseName, gradeShort } from "@/lib/learn/names";
import type { CourseOutline, LearnSubject } from "@/lib/learn/types";

type Row = ImportRow;
type Result = ImportResult;

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
  // 이름이 겹치는 유닛에 숫자를 붙여 넣기 (제안 단추로 켠다)
  const [rename, setRename] = useState(false);
  // 대량 파일 올리기: 읽은 파일들 (있으면 붙여 넣은 글 대신 이것을 묶음으로 나눠 보낸다)
  const [bulk, setBulk] = useState<BulkFile[] | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    apply: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const ready = result && !result.applied ? result.rows.filter((r) => r.status === "ok").length : 0;

  async function send(apply: boolean, renameDuplicates = rename) {
    if (bulk) return sendBulk(apply, renameDuplicates);
    setBusy(true);
    setError(null);
    setRename(renameDuplicates);
    try {
      const r = await adminApi<Result>("/api/admin/learn/import", {
        method: "POST",
        body: { text, apply, publish, renameDuplicates },
      });
      setResult(r);
      if (apply) toast(`유닛 ${r.added}개를 넣었어요${publish ? " (공개)" : " (초안)"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했어요.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  /** 대량: 묶음(요청 하나에 2MB·유닛 150개 이하)으로 나눠 차례로 검사하거나 넣는다 */
  async function sendBulk(apply: boolean, renameDuplicates: boolean) {
    const batches = packBatches(bulk!.flatMap((f) => f.courses));
    if (batches.length === 0) return;
    setBusy(true);
    setError(null);
    setRename(renameDuplicates);
    const parts: Result[] = [];
    try {
      for (const [i, batch] of batches.entries()) {
        setProgress({ done: i, total: batches.length, apply });
        parts.push(
          await adminApi<Result>("/api/admin/learn/import", {
            method: "POST",
            body: {
              text: JSON.stringify(batch),
              apply,
              publish,
              renameDuplicates,
            },
          }),
        );
      }
      const merged = mergeResults(parts, renameDuplicates);
      setResult(merged);
      if (apply) toast(`유닛 ${merged.added}개를 넣었어요${publish ? " (공개)" : " (초안)"}.`);
    } catch (e) {
      const why = e instanceof Error ? e.message : "처리하지 못했어요.";
      setError(
        `${batches.length}묶음 중 ${parts.length + 1}번째 묶음에서 멈췄어요: ${why}${apply && parts.length ? `\n앞의 ${parts.length}묶음(유닛 ${parts.reduce((n, p) => n + p.added, 0)}개)은 이미 들어갔어요. 다시 넣으면 이미 넣은 유닛은 '이미 있음'으로 건너뛰어요(숫자 붙이기는 끄고 넣으세요).` : ""}`,
      );
      setResult(apply && parts.length ? mergeResults(parts, renameDuplicates) : null);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  /** 파일 하나(작은 것)는 글 칸에, 여러 개나 큰 파일은 대량 올리기로 읽는다. 폴더에서는 .json만 */
  async function onFiles(picked: File[]) {
    const files = picked.filter((f) => /\.(json|txt)$/i.test(f.name) || f.type === "application/json");
    setResult(null);
    setRename(false);
    setError(null);
    if (files.length === 0) return setError("JSON 파일이 없어요.");
    if (files.length === 1 && files[0].size <= 300_000) {
      setBulk(null);
      setText(await files[0].text());
      return;
    }
    setBulk(await readBulkFiles(files.sort((x, y) => x.name.localeCompare(y.name, "ko", { numeric: true }))));
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
        다른 AI 에이전트로 만든 학습 유닛(JSON)을 한꺼번에 넣어요. 먼저 <b>검사</b>로 결과를 확인하고 넣으세요. 섹션이 없으면 새로 만들고, 문제가 있는 유닛과
        이미 있는 유닛은 건너뛰어요. 넣은 유닛은 기본으로 초안이라 학습 과정에서 확인한 뒤 공개해요.
      </p>

      <PromptMaker />

      <section className="space-y-3">
        <SectionTitle>2. 만든 JSON 넣기</SectionTitle>
        <Card className="space-y-3">
          {bulk ? (
            <BulkSummary files={bulk} onClear={() => (setBulk(null), setResult(null), setRename(false))} />
          ) : (
            <Field label="JSON 붙여 넣기 (코스 하나, 코스 여러 개의 배열 모두 돼요)">
              <TextArea
                rows={12}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setResult(null);
                  setRename(false);
                }}
                className="font-mono text-xs"
                placeholder='{ "grade": "m1", "subject": "math", "section": "소인수분해", "units": [ ... ] }'
              />
            </Field>
          )}
          <div
            className={cn("flex flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed p-3", dragging ? "border-accent bg-surface-2" : "border-line")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const files = [...e.dataTransfer.files];
              if (files.length) void onFiles(files);
            }}
          >
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
            <label className="cursor-pointer rounded-lg border-2 border-line px-3 py-1 text-sm">
              🗂️ 폴더째 고르기
              <input
                type="file"
                multiple
                className="sr-only"
                {...{ webkitdirectory: "" }}
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = "";
                  if (files.length) void onFiles(files);
                }}
              />
            </label>
            <span className="text-xs text-ink-soft">또는 파일·폴더를 여기에 끌어다 놓기</span>
            <Button size="sm" className="ml-auto" disabled={busy || (bulk ? bulk.every((f) => !f.units) : !text.trim())} onClick={() => send(false, false)}>
              {busy && !ready ? "검사하는 중…" : "검사하기"}
            </Button>
          </div>
          {progress && (
            <div className="space-y-1" role="status">
              <progress className="w-full" value={progress.done} max={progress.total} aria-label={progress.apply ? "넣는 중" : "검사하는 중"} />
              <p className="text-xs text-ink-soft">
                {progress.apply ? "넣는 중" : "검사하는 중"} {progress.done}/{progress.total}묶음
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="whitespace-pre-line text-sm text-danger">
              {error}
            </p>
          )}
        </Card>
      </section>

      {result && <ResultView result={result} />}

      {result && !result.applied && (result.rows.some((r) => r.status === "duplicate") || rename) && (
        <Card className="flex flex-wrap items-center gap-3" role="region" aria-label="이름이 겹치는 유닛">
          {rename ? (
            <>
              <p className="flex-1 text-sm">
                이름이 겹치는 유닛 {result.rows.filter((r) => r.renamedFrom).length}개는 뒤에 숫자를 붙여 넣어요. 표에서 바뀐 이름을 확인하세요.
              </p>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => send(false, false)}>
                숫자 붙이지 않기
              </Button>
            </>
          ) : (
            <>
              <p className="flex-1 text-sm">
                같은 섹션에 같은 이름의 유닛이 있어서 {result.rows.filter((r) => r.status === "duplicate").length}
                개를 건너뛰어요. 다른 내용이라면 이름 뒤에 숫자(1, 2 …)를 붙여 함께 넣을 수 있어요.
              </p>
              <Button size="sm" disabled={busy} onClick={() => send(false, true)}>
                이름 뒤에 숫자 붙여 넣기
              </Button>
            </>
          )}
        </Card>
      )}

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
            유닛 {result.added}개를 넣었어요
            {result.sectionsAdded ? `, 섹션 ${result.sectionsAdded}개를 새로 만들었어요` : ""}.
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

/** 대량 올리기: 읽은 파일 목록 (파일마다 코스·유닛 수, 읽지 못한 까닭) */
function BulkSummary({ files, onClear }: { files: BulkFile[]; onClear: () => void }) {
  const bad = files.filter((f) => f.error);
  const courses = files.reduce((n, f) => n + f.courses.length, 0);
  const units = files.reduce((n, f) => n + f.units, 0);
  const mb = files.reduce((n, f) => n + f.size, 0) / 1_000_000;
  return (
    <div className="space-y-2" role="region" aria-label="올릴 파일">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm font-display">
          파일 {files.length}개 · 코스 {courses}개 · 유닛 {units}개 ({mb < 0.1 ? "0.1MB 미만" : `${mb.toFixed(1)}MB`})
          {bad.length > 0 && <span className="text-danger"> · 읽지 못한 파일 {bad.length}개</span>}
        </p>
        <Button size="sm" variant="ghost" onClick={onClear}>
          파일 비우기
        </Button>
      </div>
      <ul className="max-h-60 divide-y divide-line overflow-y-auto rounded-2xl border-2 border-line text-sm" aria-label="파일 목록">
        {files.map((f) => (
          <li key={f.name} className="px-3 py-1.5">
            <span className="break-all">{f.name}</span>
            <span className={cn("ml-2 text-xs", f.error ? "text-danger" : "text-ink-soft")}>
              {f.error ? "읽지 못함" : `코스 ${f.courses.length} · 유닛 ${f.units}`}
            </span>
            {f.error && <p className="whitespace-pre-line text-xs text-danger">{f.error}</p>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-soft">읽지 못한 파일은 빼고 보내요. 서버에는 2MB·유닛 150개씩 묶어 차례로 보내고, 넣기는 묶음마다 따로 들어가요.</p>
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
                    {r.renamedFrom && <span className="block text-xs text-ink-soft">원래 이름: {r.renamedFrom}</span>}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {r.steps} · {r.questions} · {r.figures}
                  </Td>
                  <Td>
                    {r.unitId ? (
                      <StatusBadge status="draft" />
                    ) : (
                      <span className={cn("inline-block whitespace-nowrap rounded-full border-2 px-2 py-0.5 text-xs", STATUS[r.status][1])}>
                        {STATUS[r.status][0]}
                      </span>
                    )}
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
  const [subject, setSubject] = useState("math");
  const [section, setSection] = useState("");
  // 섹션마다 유닛을 많이: 여러 교과서의 소단원을 모아 잘게 나눈다
  const [count, setCount] = useState("15");
  const [outline, setOutline] = useState<CourseOutline | null>(null);
  const [subjects, setSubjects] = useState<LearnSubject[]>([]);

  useEffect(() => {
    adminApi<{ outline: CourseOutline; subjects: LearnSubject[] }>(`/api/admin/learn?grade=${grade}&subject=${subject}`).then(
      (r) => {
        setOutline(r.outline);
        setSubjects(r.subjects);
      },
      () => setOutline(null),
    );
  }, [grade, subject]);

  const meta = subjects.find((s) => s.key === subject);
  // 섹션 후보: 이미 있는 섹션 + (비슷한 기본 과목의) 교육과정 대표 단원
  const sections = useMemo(
    () => [...new Set([...(outline?.sections.map((s) => s.title) ?? []), ...(meta?.group ? coursesFor(grade, meta.group).flatMap((c) => c.units) : [])])],
    [outline, grade, meta],
  );
  const chosen = section && sections.includes(section) ? section : (sections[0] ?? "");
  const chosenSection = outline?.sections.find((s) => s.title === chosen);
  const existing = chosenSection?.units.map((u) => u.title) ?? [];
  const prompt = chosen
    ? agentPrompt({
        grade,
        subject,
        subjectName: meta?.name,
        group: meta?.group,
        section: chosen,
        sectionNote: chosenSection?.description,
        count: Math.max(1, Math.min(50, Number(count) || 15)),
        existing,
      })
    : "";

  return (
    <section className="space-y-3">
      <SectionTitle>1. AI 에이전트에게 줄 지시문 만들기</SectionTitle>
      <Card className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label="학년">
            <Select
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value as GradeId);
                if (!SUBJECT_GROUPS.some((g) => g.id === subject)) setSubject("math");
              }}
            >
              {GRADES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="과목">
            <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {(subjects.length ? subjects : SUBJECT_GROUPS.map((g) => ({ key: g.id, name: g.label }))).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
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
        {sections.length === 0 && (
          <p className="text-xs text-ink-soft">이 과목은 교육과정 단원이 비어 있어요. 학습 과정에서 섹션을 먼저 만들면 여기에 나와요.</p>
        )}
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
                {gradeShort(grade)} {meta?.name ?? subject} · {chosen}
                {existing.length ? ` · 이미 있는 유닛 ${existing.length}개는 겹치지 않게 넣었어요` : ""}
              </span>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
