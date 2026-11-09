"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAiStatus } from "@/components/ai/useAiStatus";
import { Empty, Field, PageHeader, Select, SubjectPicker, TextArea, TextInput, useSubjects } from "@/components/kit";
import { Markdown } from "@/components/Markdown";
import { toast } from "@/components/Toaster";
import { Button, Card, SectionTitle, buttonStyles, cn } from "@/components/ui";
import { gradeLabel } from "@/data/curriculum";
import { methodById, type StudyMethod } from "@/data/methods";
import { requestFeedback } from "@/lib/ai/client";
import { getDB } from "@/lib/db";
import { addMethodLog } from "@/lib/db/coaching";
import type { AiFeedback } from "@/lib/db/types";
import { useProfile } from "@/lib/hooks";
import { useNow } from "@/lib/timerStore";

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <Practice />
    </Suspense>
  );
}

interface Common {
  subjectId?: string;
  topic: string;
}

function Practice() {
  const id = useSearchParams().get("id") ?? "";
  const method = methodById(id);
  const subjects = useSubjects() ?? [];
  const [common, setCommon] = useState<Common>({ topic: "" });
  if (!method) {
    return (
      <>
        <PageHeader title="실습" back="/methods" />
        <Card>
          <Empty icon="🔍">학습법을 찾을 수 없어요.</Empty>
        </Card>
      </>
    );
  }
  return (
    <div className="space-y-4">
      <PageHeader title={`${method.icon} ${method.name} 해보기`} back={`/methods/detail?id=${method.id}`} />
      <Card className="space-y-3">
        <SubjectPicker subjects={subjects} value={common.subjectId} onChange={(subjectId) => setCommon({ ...common, subjectId })} allowNone noneLabel="과목 없음" />
        <Field label={method.practice === "blank" ? "단원 / 주제" : "공부할 주제"}>
          <TextInput value={common.topic} onChange={(e) => setCommon({ ...common, topic: e.target.value })} placeholder="예: 이차방정식의 풀이" maxLength={60} />
        </Field>
      </Card>
      {method.practice === "blank" && <BlankPractice method={method} common={common} />}
      {method.practice === "feynman" && <FeynmanPractice method={method} common={common} />}
      {method.practice === "cornell" && <CornellPractice method={method} common={common} />}
      {method.practice === "guided" && <GuidedPractice method={method} common={common} />}
    </div>
  );
}

/** 실습 저장 후 학습법 화면으로 */
function useSave(method: StudyMethod, common: Common) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  async function save(fields: Record<string, string>, extra: { recall?: number; aiFeedback?: AiFeedback } = {}) {
    setSaving(true);
    const { xp } = await addMethodLog({ methodId: method.id, subjectId: common.subjectId, topic: common.topic.trim() || undefined, fields, ...extra });
    toast(xp ? `${method.name} 완료! +${xp} XP` : `${method.name} 기록을 저장했어요`);
    router.replace(`/methods/detail?id=${method.id}`);
  }
  return { save, saving };
}

function useFeedback(kind: "blank" | "feynman", common: Common) {
  const profile = useProfile();
  const subjects = useSubjects() ?? [];
  const { status, remaining, refresh } = useAiStatus();
  const [feedback, setFeedback] = useState<AiFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function ask(text: string, reference?: string) {
    setLoading(true);
    setError(null);
    try {
      setFeedback(
        await requestFeedback({
          kind,
          grade: profile ? gradeLabel(profile.grade) : "중·고등학생",
          subject: subjects.find((s) => s.id === common.subjectId)?.name,
          topic: common.topic.trim() || "주제",
          text,
          reference,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "피드백을 받지 못했어요.");
    } finally {
      setLoading(false);
      refresh();
    }
  }
  const available = !!status?.configured && remaining("coach") !== 0;
  return { feedback, loading, error, ask, available, left: remaining("coach") };
}

function FeedbackView({ f }: { f: AiFeedback }) {
  return (
    <Card className="space-y-2 border-accent">
      <div className="flex items-center justify-between">
        <p className="font-display">🤖 AI 피드백</p>
        <span className="font-display text-xl text-accent-deep">{f.score}점</span>
      </div>
      {f.good.length > 0 && <List title="👍 잘한 점" items={f.good} />}
      {f.missing.length > 0 && <List title="🧩 빠진 개념" items={f.missing} />}
      {f.misconceptions.length > 0 && <List title="⚠️ 다시 확인할 점" items={f.misconceptions} />}
      <p className="rounded-2xl bg-surface-2 p-2 text-sm">👉 {f.nextStep}</p>
    </Card>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="text-sm">
      <p className="font-display">{title}</p>
      <ul className="ml-4 list-disc">
        {items.map((x) => (
          <li key={x}>
            <Markdown>{x}</Markdown>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AiFeedbackButton({ fb, onAsk, disabled }: { fb: ReturnType<typeof useFeedback>; onAsk: () => void; disabled: boolean }) {
  return (
    <div className="space-y-1">
      <Button variant="accent" className="w-full" disabled={disabled || !fb.available || fb.loading} onClick={onAsk}>
        {fb.loading ? "AI가 읽는 중…" : "🤖 AI에게 피드백 받기"}
      </Button>
      <p className="text-center text-xs text-ink-soft">{fb.available ? `오늘 ${fb.left}회 남음 · 선택 사항이에요` : "AI가 설정되지 않았거나 오늘 횟수를 모두 썼어요"}</p>
      {fb.error && <p className="text-sm text-danger">{fb.error}</p>}
    </div>
  );
}

function Stopwatch({ goalMin }: { goalMin: number }) {
  const [startedAt] = useState(() => Date.now());
  const now = useNow(true, 1000);
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const over = sec >= goalMin * 60;
  return (
    <span className={cn("font-display tabular-nums", over ? "text-success-deep" : "text-ink-soft")}>
      ⏱️ {String(Math.floor(sec / 60)).padStart(2, "0")}:{String(sec % 60).padStart(2, "0")} / {goalMin}:00
    </span>
  );
}

function BlankPractice({ method, common }: { method: StudyMethod; common: Common }) {
  const [phase, setPhase] = useState<"write" | "compare">("write");
  const [text, setText] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const materials = useLiveQuery(async () => (await getDB().materials.toArray()).sort((a, b) => b.createdAt - a.createdAt), []);
  const fitting = (materials ?? []).filter((m) => !common.subjectId || !m.subjectId || m.subjectId === common.subjectId);
  const material = fitting.find((m) => m.id === materialId);
  const fb = useFeedback("blank", common);
  const { save, saving } = useSave(method, common);
  const recall = material?.keyPoints.length ? Math.round((checked.length / material.keyPoints.length) * 100) : undefined;

  if (phase === "write") {
    return (
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-display">1. 보지 않고 모두 써 보세요</p>
          <Stopwatch goalMin={10} />
        </div>
        <TextArea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={"개념, 공식, 흐름, 예시… 기억나는 대로 모두!\n종이에 쓰고 사진만 정리해 둬도 좋아요."} aria-label="백지 복습 내용" maxLength={6000} />
        <Button className="w-full" disabled={!text.trim()} onClick={() => setPhase("compare")}>
          다 썼어요 → 비교하기
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <p className="font-display">2. 자료와 비교해요</p>
        <p className="text-sm text-ink-soft">교과서를 펴서 빠진 것을 확인하거나, AI 학습실에서 정리한 자료의 핵심과 비교할 수 있어요.</p>
        {fitting.length > 0 && (
          <Field label="비교할 정리 자료 (선택)">
            <Select
              value={materialId}
              onChange={(e) => {
                setMaterialId(e.target.value);
                setChecked([]);
              }}
            >
              <option value="">교과서로 직접 비교</option>
              {fitting.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {material && material.keyPoints.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm">내가 쓴 핵심에 체크하세요</p>
            {material.keyPoints.map((k) => (
              <label key={k} className="flex items-start gap-2 rounded-xl px-1 py-1 text-sm">
                <input type="checkbox" className="mt-1 size-5 accent-[var(--success)]" checked={checked.includes(k)} onChange={(e) => setChecked(e.target.checked ? [...checked, k] : checked.filter((x) => x !== k))} />
                <Markdown className="flex-1">{k}</Markdown>
              </label>
            ))}
            <p className="font-display text-right text-sm">떠올린 핵심 {recall}%</p>
          </div>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-soft">내가 쓴 내용 보기</summary>
          <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-surface-2 p-3">{text}</p>
        </details>
      </Card>
      <AiFeedbackButton fb={fb} disabled={!text.trim()} onAsk={() => fb.ask(text, material ? `${material.summary}\n\n핵심: ${material.keyPoints.join(" / ")}` : undefined)} />
      {fb.feedback && <FeedbackView f={fb.feedback} />}
      <Button size="lg" variant="success" className="w-full" disabled={saving} onClick={() => save({ text }, { recall, aiFeedback: fb.feedback ?? undefined })}>
        ✅ 백지 복습 완료
      </Button>
      <p className="text-center text-xs text-ink-soft">빠진 부분은 다시 공부하고, 며칠 뒤 한 번 더 해 보세요.</p>
    </div>
  );
}

const FEYNMAN_CHECKS = ["어려운 용어 없이 설명했어요", "예시나 비유를 하나 넣었어요", "막히는 곳을 찾아서 표시했어요"];

function FeynmanPractice({ method, common }: { method: StudyMethod; common: Common }) {
  const [text, setText] = useState("");
  const [stuck, setStuck] = useState("");
  const [checks, setChecks] = useState<string[]>([]);
  const fb = useFeedback("feynman", common);
  const { save, saving } = useSave(method, common);
  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <p className="font-display">동생에게 가르치듯 쉬운 말로 설명해 보세요</p>
        <TextArea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 이차방정식은 x를 두 번 곱한 게 들어 있는 식이야. 마치…" aria-label="쉬운 설명" maxLength={6000} />
        <Field label="설명하다가 막힌 곳 (선택)">
          <TextInput value={stuck} onChange={(e) => setStuck(e.target.value)} placeholder="예: 왜 판별식이 0이면 근이 하나인지" maxLength={200} />
        </Field>
        <div className="space-y-1">
          {FEYNMAN_CHECKS.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-5 accent-[var(--success)]" checked={checks.includes(c)} onChange={(e) => setChecks(e.target.checked ? [...checks, c] : checks.filter((x) => x !== c))} />
              {c}
            </label>
          ))}
        </div>
      </Card>
      <AiFeedbackButton fb={fb} disabled={!text.trim()} onAsk={() => fb.ask(stuck ? `${text}\n\n(막힌 곳: ${stuck})` : text)} />
      {fb.feedback && <FeedbackView f={fb.feedback} />}
      <Button size="lg" variant="success" className="w-full" disabled={!text.trim() || saving} onClick={() => save({ text, stuck, checks: checks.join(", ") }, { aiFeedback: fb.feedback ?? undefined })}>
        ✅ 설명 완료
      </Button>
      {stuck && <p className="text-center text-xs text-ink-soft">막힌 곳은 교과서나 AI 튜터로 확인한 뒤 다시 설명해 보세요.</p>}
    </div>
  );
}

function CornellPractice({ method, common }: { method: StudyMethod; common: Common }) {
  const [cues, setCues] = useState("");
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState("");
  const [quiz, setQuiz] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const { save, saving } = useSave(method, common);
  const filled = cues.trim() && notes.trim() && summary.trim();

  if (quiz) {
    return (
      <div className="space-y-3">
        <Card className="space-y-3">
          <p className="font-display">🙈 필기를 가리고, 질문에 답해 보세요</p>
          <p className="whitespace-pre-wrap rounded-2xl bg-accent/10 p-3">{cues}</p>
          {revealed ? <p className="whitespace-pre-wrap rounded-2xl bg-surface-2 p-3 text-sm">{notes}</p> : null}
          <Button variant="ghost" className="w-full" onClick={() => setRevealed(!revealed)}>
            {revealed ? "필기 가리기" : "필기 보기"}
          </Button>
        </Card>
        <Button size="lg" variant="success" className="w-full" disabled={saving} onClick={() => save({ cues, notes, summary })}>
          ✅ 코넬 노트 완료
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-0 overflow-hidden p-0">
        <div className="grid grid-cols-[38%_1fr]">
          <label className="block border-r-2 border-line p-3">
            <span className="font-display text-xs text-accent-deep">키워드·질문</span>
            <textarea value={cues} onChange={(e) => setCues(e.target.value)} rows={10} maxLength={2000} placeholder={"광합성이란?\n왜 빛이 필요할까?"} className="mt-1 w-full resize-none bg-transparent text-sm outline-none" />
          </label>
          <label className="block p-3">
            <span className="font-display text-xs text-accent-deep">필기</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={10} maxLength={4000} placeholder="수업 내용을 짧게 적어요" className="mt-1 w-full resize-none bg-transparent text-sm outline-none" />
          </label>
        </div>
        <label className="block border-t-2 border-line p-3">
          <span className="font-display text-xs text-accent-deep">요약 (2~3문장, 교과서를 보지 않고)</span>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={1000} className="mt-1 w-full resize-none bg-transparent text-sm outline-none" />
        </label>
      </Card>
      <Button size="lg" className="w-full" disabled={!filled} onClick={() => setQuiz(true)}>
        다 썼어요 → 가리고 떠올리기
      </Button>
    </div>
  );
}

function GuidedPractice({ method, common }: { method: StudyMethod; common: Common }) {
  const [done, setDone] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const { save, saving } = useSave(method, common);
  const all = done.length === method.steps.length;
  return (
    <div className="space-y-3">
      <SectionTitle action={<Stopwatch goalMin={method.minutes} />}>단계별로 해보기</SectionTitle>
      <Card className="space-y-2">
        {method.steps.map((s, i) => (
          <label key={s} className={cn("flex items-start gap-3 rounded-2xl p-2", done.includes(i) && "bg-success/10")}>
            <input type="checkbox" className="mt-0.5 size-5 accent-[var(--success)]" checked={done.includes(i)} onChange={(e) => setDone(e.target.checked ? [...done, i] : done.filter((x) => x !== i))} />
            <span className={cn("text-sm", done.includes(i) && "text-ink-soft line-through")}>
              <b className="font-display">{i + 1}.</b> {s}
            </span>
          </label>
        ))}
      </Card>
      {method.links && (
        <div className="flex flex-wrap gap-2">
          {method.links.map((l) => (
            <Link key={l.href} href={l.href} className={buttonStyles("ghost", "sm")}>
              {l.label} ↗
            </Link>
          ))}
        </div>
      )}
      <Field label="해보고 느낀 점·메모 (선택)">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="예: 섞어서 푸니까 처음엔 헷갈렸지만 유형이 구분되기 시작했다" maxLength={2000} />
      </Field>
      <Button size="lg" variant="success" className="w-full" disabled={!all || saving} onClick={() => save({ notes, steps: `${done.length}/${method.steps.length}` })}>
        {all ? "✅ 완료" : `단계를 모두 체크하세요 (${done.length}/${method.steps.length})`}
      </Button>
    </div>
  );
}
