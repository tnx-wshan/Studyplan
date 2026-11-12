"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/admin/AdminShell";
import { ImageTextArea } from "@/components/admin/ImageTextArea";
import { askConfirm } from "@/components/Dialogs";
import { Field, Select, TextArea, TextInput } from "@/components/kit";
import { Markdown } from "@/components/Markdown";
import { toast } from "@/components/Toaster";
import { Button, Card, SectionTitle } from "@/components/ui";
import { GRADES, SUBJECT_GROUPS } from "@/data/curriculum";
import { PUBLISHERS } from "@/data/publishers";
import { adminApi, formatTime } from "@/lib/admin/client";
import type { StoredQuestion } from "@/lib/ai/schemas";

interface MaterialData {
  summary: string;
  keyPoints: string[];
  sources: { title: string; url: string }[];
  notice?: string;
}
interface QuizData {
  questions: StoredQuestion[];
  verified: boolean;
  difficulty: "easy" | "normal" | "hard";
}
interface Item {
  id: string;
  kind: "material" | "quiz";
  sourceKind: string;
  grade: string;
  subject: string;
  subjectName: string;
  publisher: string;
  year: number | null;
  unit: string;
  topic: string;
  title: string;
  data: MaterialData | QuizData;
  parentId: string | null;
  madeBy: string;
  uses: number;
  status: "active" | "hidden";
  edited: boolean;
  createdAt: number;
  updatedAt: number;
}

export default function AdminItemPage() {
  return (
    <Suspense fallback={null}>
      <ItemEditor />
    </Suspense>
  );
}

function ItemEditor() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [children, setChildren] = useState<Item[]>([]);
  const [parent, setParent] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      adminApi<{ item: Item; children: Item[]; parent: Item | null }>(`/api/admin/bank/item?id=${encodeURIComponent(id)}`).then(
        (r) => {
          setItem(r.item);
          setChildren(r.children);
          setParent(r.parent);
        },
        (e: Error) => setError(e.message),
      ),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!item) return;
    setSaving(true);
    try {
      await adminApi("/api/admin/bank/item", { method: "PUT", body: { id: item.id, title: item.title, topic: item.topic, grade: item.grade, subject: item.subject, publisher: item.publisher, year: item.year, unit: item.unit, status: item.status, data: item.data } });
      toast("저장했어요. 다음 요청부터 고친 내용이 나가요.");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p role="alert" className="text-danger">{error}</p>;
  if (!item) return <p className="text-ink-soft">불러오는 중…</p>;
  const set = (patch: Partial<Item>) => setItem({ ...item, ...patch });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/content" className="text-sm underline">
          ‹ 자료 모음
        </Link>
        <h1 className="font-display flex-1 text-2xl">{item.kind === "material" ? "정리 고치기" : "문제 세트 고치기"}</h1>
        <StatusBadge status={item.status} />
      </div>
      <p className="text-xs text-ink-soft">
        만든 때 {formatTime(item.createdAt)} · {item.madeBy || "AI"} · {item.uses}번 다시 쓰임{item.edited ? ` · 마지막 수정 ${formatTime(item.updatedAt)}` : ""}
        {parent && (
          <>
            {" "}
            · 바탕 자료:{" "}
            <Link className="underline" href={`/admin/content/item?id=${parent.id}`}>
              {parent.title}
            </Link>
          </>
        )}
      </p>

      <Card className="grid gap-3 md:grid-cols-2">
        <Field label="제목">
          <TextInput value={item.title} maxLength={100} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="주제 (비슷한 자료 찾기에 써요)">
          <TextInput value={item.topic} maxLength={200} onChange={(e) => set({ topic: e.target.value })} />
        </Field>
        <Field label="학년">
          <Select value={item.grade} onChange={(e) => set({ grade: e.target.value })}>
            <option value="">모름</option>
            {GRADES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="과목">
          <Select value={item.subject} onChange={(e) => set({ subject: e.target.value })}>
            <option value="">모름</option>
            {SUBJECT_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="교과서 출판사">
          <TextInput value={item.publisher} maxLength={40} list="publisher-list" onChange={(e) => set({ publisher: e.target.value })} placeholder="모르면 비워 두세요" />
          <datalist id="publisher-list">
            {PUBLISHERS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="교과서 연도">
          <TextInput type="number" min={2000} max={2100} value={item.year ?? ""} onChange={(e) => set({ year: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="교과서 단원">
          <TextInput value={item.unit} maxLength={120} onChange={(e) => set({ unit: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={item.status === "hidden"} onChange={(e) => set({ status: e.target.checked ? "hidden" : "active" })} />
          숨기기 (학생에게 주지 않고, 같은 요청이 오면 AI가 새로 만들어요)
        </label>
      </Card>

      {item.kind === "material" ? (
        <MaterialEditor data={item.data as MaterialData} onChange={(data) => set({ data })} />
      ) : (
        <QuizEditor data={item.data as QuizData} onChange={(data) => set({ data })} />
      )}

      <div className="sticky bottom-3 flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "저장하는 중…" : "저장"}
        </Button>
        <Button
          variant="ghost"
          className="text-danger"
          onClick={async () => {
            if (!(await askConfirm(item.kind === "material" ? "이 정리와, 이 정리로 만든 문제 세트를 모두 지울까요?" : "이 문제 세트를 지울까요?", { confirmLabel: "지우기", danger: true }))) return;
            await adminApi(`/api/admin/bank/item?id=${item.id}`, { method: "DELETE" });
            router.push("/admin/content");
          }}
        >
          지우기
        </Button>
      </div>

      {item.kind === "material" && (
        <section>
          <SectionTitle>이 정리로 만든 문제 세트</SectionTitle>
          <Card className="p-2">
            {children.length === 0 ? (
              <p className="p-2 text-sm text-ink-soft">아직 없어요.</p>
            ) : (
              <ul className="divide-y divide-line">
                {children.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 p-2 text-sm">
                    <Link href={`/admin/content/item?id=${c.id}`} className="flex-1 underline">
                      {c.title}
                    </Link>
                    <span className="text-xs text-ink-soft">{(c.data as QuizData).questions.length}문제</span>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}

function MaterialEditor({ data, onChange }: { data: MaterialData; onChange: (d: MaterialData) => void }) {
  const [preview, setPreview] = useState(false);
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display">정리 내용</p>
        <button type="button" className="text-sm underline" onClick={() => setPreview(!preview)}>
          {preview ? "고치기" : "미리 보기"}
        </button>
      </div>
      {preview ? (
        <Markdown>{data.summary}</Markdown>
      ) : (
        <ImageTextArea label="정리 (마크다운, 수식은 $...$, 그림 가능)" rows={14} value={data.summary} onChange={(summary) => onChange({ ...data, summary })} className="font-mono text-sm" />
      )}
      <Field label="핵심 (한 줄에 하나)">
        <TextArea
          rows={5}
          value={data.keyPoints.join("\n")}
          onChange={(e) =>
            onChange({
              ...data,
              keyPoints: e.target.value
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        />
      </Field>
      {data.sources.length > 0 && (
        <div className="text-xs">
          <p className="text-ink-soft">출처</p>
          <ul>
            {data.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

const TYPE_LABELS = { multiple: "객관식", short: "단답형", essay: "서술형" } as const;

function QuizEditor({ data, onChange }: { data: QuizData; onChange: (d: QuizData) => void }) {
  const setQ = (i: number, patch: Partial<StoredQuestion>) => onChange({ ...data, questions: data.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-3">
        <Field label="난이도">
          <Select value={data.difficulty} onChange={(e) => onChange({ ...data, difficulty: e.target.value as QuizData["difficulty"] })}>
            <option value="easy">쉬움</option>
            <option value="normal">보통</option>
            <option value="hard">어려움</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={data.verified} onChange={(e) => onChange({ ...data, verified: e.target.checked })} />
          정답 검산 완료로 표시
        </label>
      </Card>
      {data.questions.map((q, i) => (
        <Card key={i} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-display">{i + 1}번</span>
            <Select aria-label={`${i + 1}번 유형`} value={q.type} onChange={(e) => setQ(i, { type: e.target.value as StoredQuestion["type"] })} className="w-auto">
              {(Object.keys(TYPE_LABELS) as (keyof typeof TYPE_LABELS)[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
            <button type="button" className="ml-auto text-sm text-danger underline" onClick={() => onChange({ ...data, questions: data.questions.filter((_, j) => j !== i) })}>
              빼기
            </button>
          </div>
          <ImageTextArea label="문제 (그림 가능)" value={q.prompt} onChange={(prompt) => setQ(i, { prompt })} />
          {q.type === "multiple" && (
            <Field label="보기 (한 줄에 하나)">
              <TextArea rows={5} value={q.choices.join("\n")} onChange={(e) => setQ(i, { choices: e.target.value.split("\n") })} />
            </Field>
          )}
          <Field label={q.type === "multiple" ? "정답 (보기 글자 그대로)" : "정답"}>
            <TextInput value={q.answer} onChange={(e) => setQ(i, { answer: e.target.value })} />
          </Field>
          <ImageTextArea label="해설" value={q.explanation} onChange={(explanation) => setQ(i, { explanation })} />
          <Field label="확인하는 개념">
            <TextInput value={q.concept} onChange={(e) => setQ(i, { concept: e.target.value })} />
          </Field>
        </Card>
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange({ ...data, questions: [...data.questions, { type: "short", prompt: "", choices: [], answer: "", explanation: "", concept: "" }] })}>
        + 문제 추가
      </Button>
    </div>
  );
}
