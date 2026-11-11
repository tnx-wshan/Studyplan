"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/admin/AdminShell";
import { askConfirm, askText } from "@/components/Dialogs";
import { Select, TextInput } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { Button, Card, buttonStyles } from "@/components/ui";
import { GRADES, SUBJECT_GROUPS } from "@/data/curriculum";
import { adminApi } from "@/lib/admin/client";
import { gradeShort } from "@/lib/learn/names";
import type { CourseInfo, CourseOutline } from "@/lib/learn/types";

type Section = CourseOutline["sections"][number];

export default function AdminLearn() {
  const router = useRouter();
  const [grade, setGrade] = useState("m1");
  const [subject, setSubject] = useState("math");
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [outline, setOutline] = useState<CourseOutline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiFor, setAiFor] = useState<string | null>(null);

  const load = useCallback(
    () =>
      adminApi<{ courses: CourseInfo[]; outline: CourseOutline }>(`/api/admin/learn?grade=${grade}&subject=${subject}`).then(
        (r) => {
          setCourses(r.courses);
          setOutline(r.outline);
          setError(null);
        },
        (e: Error) => setError(e.message),
      ),
    [grade, subject],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function call(url: string, method: string, body?: unknown) {
    try {
      const r = await adminApi(url, { method, body });
      await load();
      return r;
    } catch (e) {
      toast(e instanceof Error ? e.message : "처리하지 못했어요.");
      return null;
    }
  }

  async function addSection() {
    const title = await askText("새 섹션(목차) 이름", { confirmLabel: "만들기" });
    if (title?.trim()) await call("/api/admin/learn/section", "POST", { grade, subject, title: title.trim() });
  }

  async function newUnit(section: Section) {
    const title = await askText(`'${section.title}'에 만들 유닛 이름`, { confirmLabel: "만들기" });
    if (!title?.trim()) return;
    const r = (await call("/api/admin/learn/unit", "POST", {
      sectionId: section.id,
      title: title.trim(),
      steps: [{ type: "summary", title: title.trim(), body: "여기에 핵심 정리를 쓰세요.", points: [] }],
    })) as { unit: { id: string } } | null;
    if (r) router.push(`/admin/learn/unit?id=${r.unit.id}`);
  }

  const count = (g: string, s: string) => courses.find((c) => c.grade === g && c.subject === s)?.units ?? 0;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">학습 과정</h1>
      <p className="text-sm text-ink-soft">코스(학년 × 과목) → 섹션(목차) → 유닛(2~3분). 초안은 학생에게 보이지 않고, 공개하면 학습 탭에 나타나요.</p>
      <div className="flex flex-wrap gap-2">
        <Select aria-label="학년" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-auto">
          {GRADES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </Select>
        <Select aria-label="과목" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-auto">
          {SUBJECT_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label} (유닛 {count(grade, g.id)})
            </option>
          ))}
        </Select>
        <Button size="sm" variant="ghost" onClick={addSection}>
          + 섹션
        </Button>
        <Link href="/admin/learn/import" className={buttonStyles("accent", "sm")}>
          ⤓ 일괄 넣기
        </Link>
        <Button size="sm" variant="ghost" onClick={() => call("/api/admin/learn/section", "POST", { grade, subject, fromCurriculum: true })}>
          교육과정 목차로 섹션 채우기
        </Button>
      </div>
      {error && <p role="alert" className="text-danger">{error}</p>}
      {outline && outline.sections.length === 0 && <Card className="text-sm text-ink-soft">{gradeShort(grade)} 코스에 아직 섹션이 없어요. 섹션을 만들거나 교육과정 목차로 채우세요.</Card>}

      <ol className="space-y-3">
        {outline?.sections.map((s, i) => (
          <li key={s.id}>
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-soft">섹션 {i + 1}</span>
                <h2 className="font-display flex-1 text-lg">{s.title}</h2>
                <IconBtn label={`${s.title} 위로`} onClick={() => call("/api/admin/learn/section", "PUT", { id: s.id, move: -1 })}>
                  ↑
                </IconBtn>
                <IconBtn label={`${s.title} 아래로`} onClick={() => call("/api/admin/learn/section", "PUT", { id: s.id, move: 1 })}>
                  ↓
                </IconBtn>
                <IconBtn
                  label={`${s.title} 이름 바꾸기`}
                  onClick={async () => {
                    const title = await askText("섹션 이름", { value: s.title });
                    if (title?.trim()) await call("/api/admin/learn/section", "PUT", { id: s.id, title: title.trim() });
                  }}
                >
                  ✎
                </IconBtn>
                <IconBtn
                  label={`${s.title} 지우기`}
                  onClick={async () => {
                    if (await askConfirm(`'${s.title}' 섹션과 그 안의 유닛 ${s.units.length}개를 지울까요?`, { confirmLabel: "지우기", danger: true })) await call(`/api/admin/learn/section?id=${s.id}`, "DELETE");
                  }}
                >
                  🗑
                </IconBtn>
              </div>
              {s.units.length > 0 && (
                <ul className="divide-y divide-line rounded-2xl border-2 border-line">
                  {s.units.map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <Link href={`/admin/learn/unit?id=${u.id}`} className="font-display flex-1 underline">
                        {u.title}
                      </Link>
                      <span className="text-xs text-ink-soft">
                        문제 {u.questionCount} · {u.minutes}분
                      </span>
                      <StatusBadge status={u.status} />
                      <IconBtn label={`${u.title} 위로`} onClick={() => call("/api/admin/learn/unit", "PUT", { id: u.id, move: -1 })}>
                        ↑
                      </IconBtn>
                      <IconBtn label={`${u.title} 아래로`} onClick={() => call("/api/admin/learn/unit", "PUT", { id: u.id, move: 1 })}>
                        ↓
                      </IconBtn>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => newUnit(s)}>
                  + 빈 유닛
                </Button>
                <Button size="sm" variant="accent" onClick={() => setAiFor(aiFor === s.id ? null : s.id)}>
                  ✨ AI로 유닛 만들기
                </Button>
              </div>
              {aiFor === s.id && <AiUnitMaker section={s} onMade={(id) => router.push(`/admin/learn/unit?id=${id}`)} />}
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="rounded-lg border-2 border-line px-2 py-0.5 text-sm">
      {children}
    </button>
  );
}

interface Suggestion {
  id: string;
  title: string;
  topic: string;
  grade: string;
  quizzes: number;
  uses: number;
  score: number;
}

/** 섹션에 어울리는 자료를 골라 AI가 겹치는 내용을 합쳐 유닛 초안을 만든다 */
function AiUnitMaker({ section, onMade }: { section: Section; onMade: (unitId: string) => void }) {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi<{ items: Suggestion[] }>(`/api/admin/learn/suggest?sectionId=${section.id}`).then(
      (r) => {
        setItems(r.items);
        setPicked(r.items.filter((x) => x.score >= 0.5).slice(0, 4).map((x) => x.id));
      },
      (e) => setError(e.message),
    );
  }, [section.id]);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi<{ unit: { id: string }; dropped: string[] }>("/api/admin/learn/generate", { method: "POST", body: { sectionId: section.id, itemIds: picked, focus: focus.trim() || undefined } });
      if (r.dropped.length) toast(`모양이 잘못된 문제 ${r.dropped.length}개는 뺐어요.`);
      onMade(r.unit.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "만들지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl bg-surface-2 p-3">
      <p className="text-sm">재료로 쓸 자료를 고르세요 (최대 8개). 같은 과목 자료 중 섹션 이름과 비슷한 순서예요.</p>
      {items === null && !error && <p className="text-sm text-ink-soft">찾는 중…</p>}
      {items && items.length === 0 && <p className="text-sm text-ink-soft">이 과목에 모인 자료가 없어요. 학생들이 AI 학습실에서 자료를 만들면 여기에 나타나요.</p>}
      {items && items.length > 0 && (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {items.map((it) => (
            <li key={it.id}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 accent-[var(--accent)]"
                  checked={picked.includes(it.id)}
                  disabled={!picked.includes(it.id) && picked.length >= 8}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, it.id] : picked.filter((x) => x !== it.id))}
                />
                <span>
                  {it.title} <span className="text-xs text-ink-soft">({it.topic} · {gradeShort(it.grade) || "학년?"} · 문제 {it.quizzes}세트 · 비슷함 {Math.round(it.score * 100)}%)</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <TextInput value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="특히 다룰 주제 (선택)" aria-label="특히 다룰 주제" maxLength={100} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button size="sm" variant="accent" disabled={busy || picked.length === 0} onClick={make}>
        {busy ? "AI가 만드는 중… (10~40초)" : `자료 ${picked.length}개로 유닛 초안 만들기`}
      </Button>
    </div>
  );
}
