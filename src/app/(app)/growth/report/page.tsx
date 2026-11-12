"use client";

import { XP_REWARDS } from "@/lib/game/level";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { useAiStatus } from "@/components/ai/useAiStatus";
import { DayColumns, SubjectBars } from "@/components/charts";
import { Empty, Field, PageHeader, TextArea, formatMinutes, useSubjectMap } from "@/components/kit";
import { MethodCard } from "@/components/methods/MethodCard";
import { toast } from "@/components/Toaster";
import { Button, Card, SectionTitle, cn } from "@/components/ui";
import { gradeLabel } from "@/data/curriculum";
import { DIMENSIONS, weakDimensions, type Dimension } from "@/data/diagnosis";
import { METHODS, methodById } from "@/data/methods";
import { requestCoach } from "@/lib/ai/client";
import { getDB } from "@/lib/db";
import { loadReportInput, saveCoachReport, saveReflection } from "@/lib/db/coaching";
import { addTask } from "@/lib/db/study";
import type { Reflection } from "@/lib/db/types";
import { toDateKey } from "@/lib/date";
import { useProfile } from "@/lib/hooks";
import { canvasToBlob, drawReportImage, shareOrDownload } from "@/lib/reportImage";
import { reportToText } from "@/lib/study/coachText";
import { periodFor, shiftPeriod, weekKey, type Period } from "@/lib/study/period";
import { change, computeReport, type ReportStats } from "@/lib/study/report";

const REASONS = { concept: "📖 개념 부족", mistake: "✏️ 실수", time: "⏰ 시간 부족", other: "❓ 기타" } as const;
const MOODS = ["😫", "😕", "😐", "🙂", "😄"];

export default function ReportPage() {
  const today = toDateKey();
  const [period, setPeriod] = useState<Period>(() => periodFor("week", today));
  const prev = shiftPeriod(period, -1);
  const isCurrent = today >= period.start && today < period.end;
  const subjectMap = useSubjectMap();
  const input = useLiveQuery(loadReportInput, []);
  const profile = useProfile();

  useEffect(() => {
    if (input && window.location.hash === "#reflection") document.getElementById("reflection")?.scrollIntoView();
  }, [input]);

  if (!input) return null;
  const now = computeReport(input, period);
  const before = computeReport(input, prev);
  const rate = (s: ReportStats) => (s.tasksPlanned ? Math.round((s.tasksDone / s.tasksPlanned) * 100) : null);
  const subjectName = (id: string) => subjectMap.get(id)?.name ?? "과목 없음";

  return (
    <div className="space-y-5">
      <PageHeader title="📊 성장 리포트" back="/growth" />

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-label="기간 종류">
        {(["week", "month"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={period.kind === k}
            onClick={() => setPeriod(periodFor(k, today))}
            className={cn("font-display rounded-xl py-1.5 text-sm", period.kind === k ? "bg-surface shadow-[var(--shadow)]" : "text-ink-soft")}
          >
            {k === "week" ? "주간" : "월간"}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="이전 기간" onClick={() => setPeriod(prev)} className="rounded-full px-3 text-2xl">
          ‹
        </button>
        <p className="font-display">
          {period.label}
          {isCurrent && <span className="ml-1 text-xs text-primary-deep">({period.kind === "week" ? "이번 주" : "이번 달"})</span>}
        </p>
        <button type="button" aria-label="다음 기간" disabled={isCurrent} onClick={() => setPeriod(shiftPeriod(period, 1))} className="rounded-full px-3 text-2xl disabled:opacity-30">
          ›
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="집중 시간" value={formatMinutes(now.totalMinutes)} delta={change(now.totalMinutes, before.totalMinutes)} />
        <Tile label="공부한 날" value={`${now.studyDays}/${now.days}일`} delta={change(now.studyDays, before.studyDays)} />
        <Tile label="계획 달성률" value={rate(now) === null ? "-" : `${rate(now)}%`} sub={`${now.tasksDone}/${now.tasksPlanned}개`} />
        <Tile label="얻은 경험치" value={`${now.xp} XP`} delta={change(now.xp, before.xp)} />
      </div>
      <p className="-mt-3 text-right text-xs text-ink-soft">↑↓ 지난 {period.kind === "week" ? "주" : "달"}와 비교</p>
      <Button
        variant="ghost"
        className="w-full"
        onClick={async () => {
          const css = getComputedStyle(document.documentElement);
          const v = (name: string) => css.getPropertyValue(name).trim() || undefined;
          const canvas = drawReportImage({
            title: period.kind === "week" ? "주간 리포트" : "월간 리포트",
            periodLabel: period.label,
            nickname: profile?.nickname ?? "",
            stats: now,
            rate: rate(now),
            subjectName,
            colors: { bg: v("--bg"), surface: v("--surface"), ink: v("--ink"), inkSoft: v("--ink-soft"), primary: v("--primary"), line: v("--line") },
          });
          const r = await shareOrDownload(await canvasToBlob(canvas), `homestudy-${period.kind}-${period.start}.png`);
          if (r === "saved") toast("리포트 이미지를 저장했어요");
        }}
      >
        🖼️ 리포트를 이미지로 저장·공유
      </Button>

      <section>
        <SectionTitle>날짜별 집중 시간</SectionTitle>
        <Card>{now.totalMinutes === 0 ? <Empty icon="📊">이 기간에는 집중 기록이 없어요.</Empty> : <DayColumns days={now.byDay} today={today} />}</Card>
      </section>

      {now.bySubject.length > 0 && (
        <section>
          <SectionTitle>과목별</SectionTitle>
          <Card>
            <SubjectBars items={now.bySubject} subjectMap={subjectMap} />
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>복습과 오답</SectionTitle>
        <Card className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini label="카드 복습" value={`${now.cardsReviewed}장`} />
            <Mini label="오답 다시 풀기" value={`${now.wrongRetried}번`} />
            <Mini label="오답 정복" value={`${now.wrongMastered}개`} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <Mini label="새 오답 기록" value={`${now.wrongAdded}개`} />
            <Mini label="AI 퀴즈 정답률" value={now.quizTotal ? `${Math.round((now.quizCorrect / now.quizTotal) * 100)}%` : "-"} />
          </div>
          {now.wrongAdded > 0 && (
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="text-ink-soft">틀린 이유</span>
              {(Object.keys(REASONS) as (keyof typeof REASONS)[])
                .filter((k) => now.wrongByReason[k] > 0)
                .map((k) => (
                  <span key={k}>
                    {REASONS[k]} <b className="font-display">{now.wrongByReason[k]}</b>
                  </span>
                ))}
            </div>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>해본 학습법</SectionTitle>
        <Card>
          {now.methodPractices.length ? (
            <ul className="space-y-1 text-sm">
              {now.methodPractices.map((m) => (
                <li key={m.methodId} className="flex justify-between">
                  <span>
                    {methodById(m.methodId)?.icon} {methodById(m.methodId)?.name ?? m.methodId}
                  </span>
                  <span className="font-display">{m.count}번</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="💡">이 기간에 해 본 학습법이 없어요.</Empty>
          )}
        </Card>
      </section>

      {period.kind === "week" ? <ReflectionForm week={period.key} /> : <MonthReflections period={period} />}

      <Coaching period={period} stats={reportToText(now, before, subjectName)} />
    </div>
  );
}

function Tile({ label, value, delta, sub }: { label: string; value: string; delta?: number | null; sub?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="font-display text-2xl">{value}</p>
      {sub && <p className="text-xs text-ink-soft">{sub}</p>}
      {delta !== undefined && delta !== null && (
        <p className={cn("text-xs", delta >= 0 ? "text-success-deep" : "text-danger")}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
        </p>
      )}
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-2">
      <p className="font-display text-lg">{value}</p>
      <p className="text-[11px] text-ink-soft">{label}</p>
    </div>
  );
}

function ReflectionForm({ week }: { week: string }) {
  const saved = useLiveQuery(async () => (await getDB().reflections.get(week)) ?? null, [week]);
  if (saved === undefined) return null;
  return <ReflectionEditor key={`${week}-${saved?.updatedAt ?? 0}`} week={week} saved={saved} />;
}

function ReflectionEditor({ week, saved }: { week: string; saved: Reflection | null }) {
  const [mood, setMood] = useState<number | undefined>(saved?.mood);
  const [good, setGood] = useState(saved?.good ?? "");
  const [bad, setBad] = useState(saved?.bad ?? "");
  const [nextGoal, setNextGoal] = useState(saved?.nextGoal ?? "");
  const [editing, setEditing] = useState(!saved);

  async function onSave() {
    const xp = await saveReflection(week, { good, bad, nextGoal, mood });
    toast(xp ? `회고 완료! +${xp} XP` : "회고를 고쳤어요");
    setEditing(false);
  }

  return (
    <section id="reflection" className="scroll-mt-20">
      <SectionTitle
        action={
          saved &&
          !editing && (
            <button type="button" className="text-sm text-ink-soft underline" onClick={() => setEditing(true)}>
              고치기
            </button>
          )
        }
      >
        ✍️ 주간 회고
      </SectionTitle>
      {editing ? (
        <Card className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm text-ink-soft">이번 주 공부, 어땠나요?</p>
            <div className="flex justify-between" role="radiogroup" aria-label="이번 주 만족도">
              {MOODS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mood === i + 1}
                  aria-label={`만족도 ${i + 1}`}
                  onClick={() => setMood(i + 1)}
                  className={cn("rounded-2xl p-2 text-3xl transition-transform", mood === i + 1 ? "scale-110 bg-bg-soft" : "opacity-60")}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Field label="잘한 점 👍" hint="작은 것도 좋아요. 예: 수학 오답을 매일 2개씩 다시 풀었다">
            <TextArea value={good} onChange={(e) => setGood(e.target.value)} maxLength={500} rows={2} />
          </Field>
          <Field label="아쉬운 점과 그 이유 🤔" hint="예: 영어 단어를 미뤘다 → 학원 숙제 후 피곤해서">
            <TextArea value={bad} onChange={(e) => setBad(e.target.value)} maxLength={500} rows={2} />
          </Field>
          <Field label="다음 주 목표 🎯" hint="언제·무엇을·얼마나 할지 정하면 지키기 쉬워요">
            <TextArea value={nextGoal} onChange={(e) => setNextGoal(e.target.value)} maxLength={500} rows={2} />
          </Field>
          <Button className="w-full" disabled={!good.trim() && !bad.trim() && !nextGoal.trim()} onClick={onSave}>
            {saved ? "저장" : `회고 저장 (+${XP_REWARDS.reflectionWritten} XP)`}
          </Button>
        </Card>
      ) : (
        saved && (
          <Card className="space-y-2 text-sm">
            {saved.mood && <p className="text-2xl">{MOODS[saved.mood - 1]}</p>}
            {saved.good && <p>👍 {saved.good}</p>}
            {saved.bad && <p>🤔 {saved.bad}</p>}
            {saved.nextGoal && <p>🎯 {saved.nextGoal}</p>}
          </Card>
        )
      )}
    </section>
  );
}

function MonthReflections({ period }: { period: Period }) {
  const list = useLiveQuery(async () => {
    const weeks = new Set<string>();
    for (let d = period.start; d < period.end; d = toDateKey(new Date(new Date(d + "T00:00:00").getTime() + 7 * 86_400_000))) weeks.add(weekKey(d));
    weeks.add(weekKey(toDateKey(new Date(new Date(period.end + "T00:00:00").getTime() - 86_400_000))));
    return (await getDB().reflections.bulkGet([...weeks])).filter((r): r is Reflection => !!r);
  }, [period.key]);
  return (
    <section id="reflection">
      <SectionTitle>✍️ 이 달의 회고</SectionTitle>
      <Card className="space-y-3 text-sm">
        {list && list.length ? (
          list.map((r) => (
            <div key={r.id} className="space-y-0.5 border-b-2 border-line pb-2 last:border-0 last:pb-0">
              <p className="font-display text-xs text-ink-soft">
                {r.week} {r.mood ? MOODS[r.mood - 1] : ""}
              </p>
              {r.good && <p>👍 {r.good}</p>}
              {r.nextGoal && <p>🎯 {r.nextGoal}</p>}
            </div>
          ))
        ) : (
          <Empty icon="✍️">이 달에 쓴 회고가 없어요. 주간 탭에서 회고를 써 보세요.</Empty>
        )}
      </Card>
    </section>
  );
}

function Coaching({ period, stats }: { period: Period; stats: string }) {
  const profile = useProfile();
  const { status, remaining, refresh } = useAiStatus();
  const report = useLiveQuery(async () => (await getDB().coachReports.where("period").equals(period.key).sortBy("createdAt")).at(-1) ?? null, [period.key]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setLoading(true);
    setError(null);
    try {
      const reflection = period.kind === "week" ? await getDB().reflections.get(period.key) : undefined;
      const scores = profile?.diagnosis?.scores as Record<Dimension, number> | undefined;
      const result = await requestCoach({
        grade: profile ? gradeLabel(profile.grade) : "중·고등학생",
        periodLabel: `${period.kind === "week" ? "주간" : "월간"} ${period.label}`,
        stats,
        reflection: reflection ? `잘한 점: ${reflection.good}\n아쉬운 점: ${reflection.bad}\n다음 목표: ${reflection.nextGoal}` : undefined,
        weakAreas: scores ? weakDimensions(scores).map((d) => DIMENSIONS[d].label) : [],
        methods: METHODS.map((m) => ({ id: m.id, name: m.name })),
      });
      await saveCoachReport({ period: period.key, ...result });
    } catch (e) {
      setError(e instanceof Error ? e.message : "코칭을 받지 못했어요.");
    } finally {
      setLoading(false);
      refresh();
    }
  }

  const available = !!status?.configured && remaining("coach") !== 0;
  return (
    <section>
      <SectionTitle>🤖 AI 코칭</SectionTitle>
      {report ? (
        <Card className="space-y-3">
          <p>{report.summary}</p>
          {report.strengths.length > 0 && <Bullets title="👍 잘한 점" items={report.strengths} />}
          {report.improvements.length > 0 && <Bullets title="🌱 보완할 점" items={report.improvements} />}
          {report.goals.length > 0 && <Bullets title="🎯 다음 목표" items={report.goals} />}
          {report.goals.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={async () => {
                const date = shiftPeriod(periodFor("week", toDateKey()), 1).start;
                for (const g of report.goals) await addTask({ date, title: `[주간 목표] ${g}`.slice(0, 60) });
                toast(`목표 ${report.goals.length}개를 다음 주 월요일 할 일로 넣었어요`);
              }}
            >
              🗓️ 목표를 다음 주 플래너에 넣기
            </Button>
          )}
          {report.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="font-display text-sm">💡 추천 학습법</p>
              {report.recommendations.map((r) => {
                const m = methodById(r.methodId);
                return m ? <MethodCard key={r.methodId} method={m} reason={r.reason} compact /> : null;
              })}
            </div>
          )}
          <p className="text-xs text-ink-soft">{report.madeBy}의 코칭 · AI 조언은 참고용이에요</p>
        </Card>
      ) : (
        <Card className="text-sm text-ink-soft">이 기간의 공부 기록{period.kind === "week" ? "과 회고" : ""}를 보고 AI가 잘한 점, 보완할 점, 다음 목표를 알려줘요. 회고를 먼저 쓰면 더 정확해요.</Card>
      )}
      <div className="mt-2 space-y-1">
        <Button variant="accent" className="w-full" disabled={!available || loading} onClick={ask}>
          {loading ? "AI가 기록을 살펴보는 중…" : report ? "🔄 코칭 다시 받기" : "🤖 AI 코칭 받기"}
        </Button>
        <p className="text-center text-xs text-ink-soft">{available ? `오늘 ${remaining("coach")}회 남음 · 공부 숫자 기록과 회고만 보내요 (이름은 보내지 않아요)` : "AI가 설정되지 않았거나 오늘 횟수를 모두 썼어요"}</p>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </section>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="text-sm">
      <p className="font-display">{title}</p>
      <ul className="ml-4 list-disc space-y-0.5">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
