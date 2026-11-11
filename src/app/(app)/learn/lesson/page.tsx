"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { askConfirm } from "@/components/Dialogs";
import { DailyGoalCard } from "@/components/learn/DailyGoalCard";
import { BlankView, ChoiceView, PuzzleView, ShortView, SummaryView } from "@/components/learn/Steps";
import { Markdown } from "@/components/Markdown";
import { useUiStyle } from "@/components/ThemeSync";
import { Button, Card, ProgressBar, buttonStyles, cn } from "@/components/ui";
import { getDB } from "@/lib/db";
import { finishUnit } from "@/lib/db/learn";
import { blankAnswers, correctAnswerText, gradeStep, puzzleTiles, shuffle, type StepAnswer } from "@/lib/learn/check";
import { fetchOutline, fetchUnit } from "@/lib/learn/client";
import { advance, cappedSeconds, currentStep, isFinished, lessonProgress, lessonScore, nextUnitId, recordResult, startLesson, type LessonState } from "@/lib/learn/engine";
import { courseKey, type LearnSection, type LearnUnit, type QuestionStep } from "@/lib/learn/types";
import { requestSync } from "@/lib/syncStore";

type Unit = LearnUnit & { section: LearnSection };
/** 화면에서 고르는 중인 답: 글자, 빈칸별 낱말(아직 빈 칸은 null), 퍼즐 조각 번호 */
type Draft = string | (string | null)[] | number[] | null;

export default function LessonPage() {
  return (
    <Suspense fallback={null}>
      <Lesson />
    </Suspense>
  );
}

function Lesson() {
  const id = useSearchParams().get("unit") ?? "";
  const [loaded, setLoaded] = useState<{ id: string; unit?: Unit; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUnit(id)
      .then((r) => !cancelled && setLoaded({ id, unit: r.data }))
      .catch((e) => !cancelled && setLoaded({ id, error: e instanceof Error ? e.message : "유닛을 불러오지 못했어요." }));
    return () => {
      cancelled = true;
    };
  }, [id]);
  const unit = loaded?.id === id ? loaded.unit : null;
  const error = loaded?.id === id ? loaded.error : null;

  if (error) {
    return (
      <div className="space-y-4 pt-10 text-center">
        <p role="alert" className="text-danger">
          {error}
        </p>
        <Link href="/learn" className={buttonStyles("ghost")}>
          학습 지도로
        </Link>
      </div>
    );
  }
  if (!unit) return <p className="pt-10 text-center text-ink-soft">유닛을 불러오는 중…</p>;
  return <Player key={unit.id + unit.updatedAt} unit={unit} />;
}

/** 단계마다 섞어 둔 보기·낱말·조각 (다시 나와도 같은 순서) */
function prepare(unit: Unit) {
  return unit.steps.map((s) => {
    if (s.type === "choice") return { choices: shuffle(s.choices) };
    if (s.type === "blank") return { words: shuffle([...blankAnswers(s), ...s.distractors]) };
    if (s.type === "puzzle") return { tiles: puzzleTiles(s) };
    return {};
  });
}

function Player({ unit }: { unit: Unit }) {
  const router = useRouter();
  const noir = useUiStyle() === "noir";
  const steps = unit.steps;
  const prepared = useMemo(() => prepare(unit), [unit]);
  const startedAt = useRef(0);
  const [state, setState] = useState<LessonState>(() => startLesson(steps));
  // 답과 채점 결과는 몇 번째 차례의 것인지 함께 기억한다 (차례가 넘어가면 저절로 비워진다)
  const [ans, setAns] = useState<{ pos: number; value: Draft }>({ pos: -1, value: null });
  const [mark, setMark] = useState<{ pos: number; ok: boolean } | null>(null);
  const [result, setResult] = useState<{ xp: number; first: boolean; seconds: number; correct: number; total: number; next?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const isMath = unit.section.subject === "math";

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const index = currentStep(state);
  const step = index !== undefined ? steps[index] : undefined;
  const retry = index !== undefined && state.pos >= steps.length;

  const empty: Draft = step?.type === "blank" ? blankAnswers(step).map(() => null) : step?.type === "puzzle" ? [] : null;
  const answer = ans.pos === state.pos ? ans.value : empty;
  const setAnswer = (value: Draft) => setAns({ pos: state.pos, value });
  const checked = mark && mark.pos === state.pos ? mark.ok : null;

  async function finish(final: LessonState) {
    setSaving(true);
    const score = lessonScore(steps, final);
    const seconds = cappedSeconds(startedAt.current, Date.now(), steps.length);
    const key = courseKey(unit.section.grade, unit.section.subject);
    const { xp, first } = await finishUnit({ unitId: unit.id, courseKey: key, title: unit.title, score, seconds });
    let next: string | undefined;
    try {
      const outline = (await fetchOutline(unit.section.grade, unit.section.subject)).data;
      const done = new Set((await getDB().learnProgress.where("courseKey").equals(key).toArray()).map((p) => p.id));
      next = nextUnitId(outline, done, unit.id);
    } catch {
      // 다음 유닛을 못 찾아도 결과는 보여준다
    }
    setResult({ xp, first, seconds, ...score, next });
    setSaving(false);
    void requestSync();
  }

  function answerReady(): boolean {
    if (!step || step.type === "summary") return true;
    if (step.type === "choice") return typeof answer === "string";
    if (step.type === "short") return typeof answer === "string" && answer.trim().length > 0;
    if (step.type === "blank") return Array.isArray(answer) && answer.every((x) => x !== null);
    if (step.type === "puzzle") return Array.isArray(answer) && answer.length === [...step.answer.replace(/\s+/g, "")].length;
    return false;
  }

  function check() {
    if (!step || index === undefined || step.type === "summary" || !answerReady()) return;
    const tiles = prepared[index].tiles ?? [];
    const given: StepAnswer = step.type === "puzzle" ? (answer as number[]).map((i) => tiles[i]).join("") : (answer as StepAnswer);
    const ok = gradeStep(step as QuestionStep, given);
    setMark({ pos: state.pos, ok });
    requestAnimationFrame(() => feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    setState((s) => recordResult(s, index, ok));
  }

  function next() {
    const moved = advance(state);
    if (isFinished(moved)) {
      setState(moved);
      void finish(moved);
    } else setState(moved);
  }

  async function quit() {
    if (await askConfirm("학습을 그만둘까요? 이번 유닛 진행 내용은 저장되지 않아요.", { confirmLabel: "그만하기", danger: true })) router.push("/learn");
  }

  if (result || saving) {
    if (!result) return <p className="pt-10 text-center text-ink-soft">기록하는 중…</p>;
    const pct = result.total ? Math.round((result.correct / result.total) * 100) : 100;
    return (
      <div className="space-y-5 pt-4">
        <div className="space-y-2 text-center">
          <p aria-hidden className="text-5xl">
            {pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "🌱"}
          </p>
          <h1 className="font-display text-2xl">{noir ? "유닛 완료." : "유닛 완료!"}</h1>
          <p className="text-ink-soft">{unit.title}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="경험치" value={`+${result.xp}`} />
          <Stat label="정답률" value={`${pct}%`} />
          <Stat label="걸린 시간" value={`${Math.max(1, Math.round(result.seconds / 60))}분`} />
        </div>
        {!result.first && <p className="text-center text-xs text-ink-soft">다시 한 유닛은 경험치를 조금만 받아요.</p>}
        <DailyGoalCard />
        <div className="grid gap-2">
          {result.next && (
            <Link href={`/learn/lesson?unit=${result.next}`} className={buttonStyles("primary", "lg")}>
              다음 유닛 →
            </Link>
          )}
          <Link href="/learn" className={buttonStyles(result.next ? "ghost" : "primary", "lg")}>
            학습 지도로
          </Link>
        </div>
      </div>
    );
  }

  if (!step || index === undefined) return null;
  const locked = checked !== null;
  const q = step.type === "summary" ? null : (step as QuestionStep);

  return (
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col gap-5">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="학습 그만하기" onClick={quit} className="text-2xl leading-none text-ink-soft">
          ×
        </button>
        <ProgressBar value={lessonProgress(state)} label="유닛 진행" color="var(--success)" className="flex-1" />
      </div>
      {retry && <p className="font-display text-sm text-primary-deep">{noir ? "다시 확인한다." : "아까 틀린 문제예요. 다시 풀어 봐요!"}</p>}

      <div className="flex-1">
        {step.type === "summary" && <SummaryView step={step} />}
        {step.type === "choice" && <ChoiceView step={step} choices={prepared[index].choices ?? step.choices} value={typeof answer === "string" ? answer : null} onChange={setAnswer} locked={locked} correct={checked} />}
        {step.type === "short" && <ShortView step={step} value={typeof answer === "string" ? answer : ""} onChange={setAnswer} onSubmit={check} locked={locked} math={isMath} />}
        {step.type === "blank" && <BlankView step={step} words={prepared[index].words ?? []} value={Array.isArray(answer) ? (answer as (string | null)[]) : []} onChange={setAnswer} locked={locked} />}
        {step.type === "puzzle" && <PuzzleView step={step} tiles={prepared[index].tiles ?? []} picked={Array.isArray(answer) ? (answer as number[]) : []} onChange={setAnswer} locked={locked} />}
      </div>

      {/* 채점 전에는 '확인' 단추가 아래에 붙어 있고, 채점 뒤에는 결과가 문제를 가리지 않게 본문 아래에 놓인다 */}
      <div ref={feedbackRef} className={cn("scroll-mb-28", checked === null && "sticky bottom-24 z-[5]")}>
        {checked !== null && q ? (
          <Card role="status" className={cn("space-y-2 border-2", checked ? "border-success" : "border-danger")}>
            <p className={cn("font-display text-lg", checked ? "text-success-deep" : "text-danger")}>
              {checked ? (noir ? "정확하다." : "정답이에요! 🎉") : noir ? "틀렸다." : "아쉬워요"}
            </p>
            {!checked && (
              <p className="text-sm">
                정답: <span className="font-display">{correctAnswerText(q)}</span>
              </p>
            )}
            {q.explanation && <Markdown className="text-sm text-ink-soft">{q.explanation}</Markdown>}
            <Button variant={checked ? "success" : "primary"} className="w-full" onClick={next}>
              계속
            </Button>
          </Card>
        ) : step.type === "summary" ? (
          <Button size="lg" className="w-full" onClick={next}>
            {noir ? "확인했다" : "알겠어요"}
          </Button>
        ) : (
          <Button size="lg" variant="accent" className="w-full" disabled={!answerReady()} onClick={check}>
            확인
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="font-display text-xl">{value}</p>
    </Card>
  );
}
