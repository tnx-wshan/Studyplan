"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Empty, PageHeader, TextInput, useSubjects } from "@/components/kit";
import { Markdown } from "@/components/Markdown";
import { Button, Card, cn } from "@/components/ui";
import { SUBJECT_GROUPS, type SubjectGroup } from "@/data/curriculum";
import { saveMaterialAndQuiz } from "@/lib/db/ai";
import { useProfile } from "@/lib/hooks";
import { gradeShort, subjectLabel } from "@/lib/learn/names";
import { classificationLabel } from "@/data/classification";
import type { StoredQuestion } from "@/lib/ai/schemas";

interface ListItem {
  id: string;
  title: string;
  topic: string;
  grade: string;
  subject: string;
  subjectName: string;
  unit: string;
  quizzes: number;
  uses: number;
}

interface Detail {
  material: { id: string; title: string; topic: string; sourceKind: string; subject: string; data: { summary: string; keyPoints: string[]; sources: { title: string; url: string }[] } };
  quizzes: { id: string; title: string; data: { questions: StoredQuestion[]; verified: boolean; difficulty: "easy" | "normal" | "hard" } }[];
}

const DIFFICULTY = { easy: "쉬움", normal: "보통", hard: "어려움" } as const;

/**
 * 모두의 자료실: 다른 학생들이 AI 학습실에서 만든 정리와 문제.
 * AI를 쓸 수 없거나 오늘 사용 횟수를 다 썼어도 이것으로 공부할 수 있다.
 */
export default function LibraryPage() {
  const router = useRouter();
  const profile = useProfile();
  const subjects = useSubjects() ?? [];
  const [subject, setSubject] = useState<SubjectGroup | "">("");
  const [mine, setMine] = useState(true);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    const p = new URLSearchParams();
    if (subject) p.set("subject", subject);
    if (mine && profile) p.set("grade", profile.grade);
    if (query) p.set("q", query);
    fetch(`/api/bank?${p}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error ?? "자료를 불러오지 못했어요.");
        if (!cancelled) {
          setItems(data.items);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요."));
    return () => {
      cancelled = true;
    };
  }, [subject, mine, query, profile]);

  async function openItem(id: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/bank/item?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "자료를 열지 못했어요.");
      setOpen(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "자료를 열지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  /** 문제를 내 기기로 가져와서 AI 퀴즈처럼 푼다 */
  async function solve(detail: Detail, quiz: Detail["quizzes"][number]) {
    setBusy(true);
    const local = subjects.find((s) => s.group === detail.material.subject);
    const kind = (["web", "photo", "pdf", "curriculum"].includes(detail.material.sourceKind) ? detail.material.sourceKind : "web") as "web";
    const saved = await saveMaterialAndQuiz(
      { kind, title: detail.material.title, summary: detail.material.data.summary, keyPoints: detail.material.data.keyPoints, sources: detail.material.data.sources, subjectId: local?.id, query: detail.material.topic },
      { title: quiz.title, difficulty: quiz.data.difficulty, verified: quiz.data.verified, madeBy: "모두의 자료실", questions: quiz.data.questions },
    );
    void fetch("/api/bank/item", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: quiz.id }) }).catch(() => {});
    router.push(`/ai/quiz?id=${saved.id}`);
  }

  if (open) {
    const m = open.material;
    return (
      <div className="space-y-4">
        <PageHeader title="📚 자료 보기" action={<button type="button" className="text-sm underline" onClick={() => setOpen(null)}>목록으로</button>} />
        <Card className="space-y-3">
          <h2 className="font-display text-xl">{m.title}</h2>
          <Markdown>{m.data.summary}</Markdown>
          {m.data.keyPoints.length > 0 && (
            <div className="rounded-2xl bg-xp/10 p-3">
              <p className="font-display mb-1 text-sm">⭐ 핵심</p>
              <ul className="space-y-1 text-sm">
                {m.data.keyPoints.map((k) => (
                  <li key={k} className="flex gap-1.5">
                    <span aria-hidden>•</span>
                    <Markdown className="flex-1">{k}</Markdown>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-ink-soft">다른 학생이 AI로 만든 자료예요. 틀린 곳이 있으면 선생님(관리자)이 고쳐요.</p>
        </Card>
        <section className="space-y-2">
          <h2 className="font-display text-lg">이 자료로 만든 문제</h2>
          {open.quizzes.length === 0 ? (
            <Empty icon="📝">아직 만든 문제가 없어요.</Empty>
          ) : (
            open.quizzes.map((quiz) => (
              <Card key={quiz.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display truncate">{quiz.title}</p>
                  <p className="text-xs text-ink-soft">
                    {quiz.data.questions.length}문제 · {DIFFICULTY[quiz.data.difficulty]}
                    {quiz.data.verified ? " · 검산 완료" : ""}
                  </p>
                </div>
                <Button size="sm" disabled={busy} onClick={() => solve(open, quiz)}>
                  풀어 보기
                </Button>
              </Card>
            ))
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="📚 모두의 자료실" back="/ai" />
      <p className="text-sm text-ink-soft">다른 학생들이 AI 학습실에서 만든 정리와 문제예요. AI를 쓰지 않아도 바로 공부할 수 있어요.</p>
      <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="주제 찾기 (예: 광합성)" aria-label="자료 찾기" />
      <div className="flex flex-wrap gap-2">
        <Chip active={subject === ""} onClick={() => setSubject("")}>
          전체
        </Chip>
        {SUBJECT_GROUPS.map((g) => (
          <Chip key={g.id} active={subject === g.id} onClick={() => setSubject(g.id)}>
            {g.label}
          </Chip>
        ))}
      </div>
      {profile && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          내 학년({gradeShort(profile.grade)}) 자료만
        </label>
      )}
      {error && (
        <Card role="alert" className="border-danger text-sm text-danger">
          {error}
        </Card>
      )}
      {items === null && !error && <p className="text-center text-sm text-ink-soft">불러오는 중…</p>}
      {items && items.length === 0 && <Empty icon="📭">아직 모인 자료가 없어요. AI 학습실에서 자료를 만들면 여기에 모여요.</Empty>}
      {items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id}>
              <button type="button" disabled={busy} onClick={() => openItem(it.id)} className="w-full text-left">
                <Card className="space-y-0.5">
                  <p className="font-display">{it.title}</p>
                  <p className="text-xs text-ink-soft">
                    {classificationLabel({ grade: it.grade ? gradeShort(it.grade) : "", subject: it.subject ? subjectLabel(it.subject) : it.subjectName || "과목 없음", unit: it.unit })} · 문제 {it.quizzes}세트 · {it.uses}번 쓰임
                  </p>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn("font-display rounded-full border-2 px-3 py-1 text-sm", active ? "border-accent bg-accent text-white" : "border-line")}>
      {children}
    </button>
  );
}
