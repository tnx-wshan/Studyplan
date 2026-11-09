"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Pet } from "@/components/Pet";
import { saveFocus } from "@/components/TimerWatcher";
import { Empty, PageHeader, SubjectChip, SubjectPicker, formatMinutes, useSubjects } from "@/components/kit";
import { Button, Card, SectionTitle, cn } from "@/components/ui";
import { getDB } from "@/lib/db";
import { setTaskDone } from "@/lib/db/study";
import { toDateKey } from "@/lib/date";
import { usePetState } from "@/lib/hooks";
import { PRESETS, elapsed, formatClock, pause, phaseLength, remaining, resume, start, stop, type TimerMode } from "@/lib/study/timer";
import { getTimer, setTimer, useNow, useTimerState } from "@/lib/timerStore";

export default function TimerPage() {
  return (
    <Suspense fallback={null}>
      <TimerScreen />
    </Suspense>
  );
}

function TimerScreen() {
  const timer = useTimerState();
  return (
    <div className="space-y-5">
      <PageHeader title="⏱️ 집중 타이머" />
      {timer.phase === "idle" ? <Setup /> : <Running />}
      <TodaySummary />
    </div>
  );
}

function Setup() {
  const params = useSearchParams();
  const subjects = useSubjects();
  const today = toDateKey();
  const todayTasks = useLiveQuery(() => getDB().tasks.where("date").equals(today).filter((t) => !t.done).toArray(), [today]);
  const last = getTimer();
  const [mode, setMode] = useState<TimerMode>(last.mode);
  const [preset, setPreset] = useState(() => Math.max(0, PRESETS.findIndex((p) => p.focusMin === last.focusMin)));
  const [taskId, setTaskId] = useState<string | undefined>(params.get("task") ?? undefined);
  // null이면 연결한 할 일의 과목을 따른다
  const [subjectChoice, setSubjectChoice] = useState<{ id?: string } | null>(() => (params.get("task") ? null : { id: last.subjectId }));
  const [notifyState, setNotifyState] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const task = todayTasks?.find((t) => t.id === taskId);
  const subjectId = subjectChoice ? subjectChoice.id : task?.subjectId;
  const setSubjectId = (id: string | undefined) => setSubjectChoice({ id });

  function onStart() {
    const p = PRESETS[preset];
    setTimer(start(getTimer(), Date.now(), { mode, focusMin: p.focusMin, breakMin: p.breakMin, subjectId, taskId: task?.id }));
  }

  return (
    <Card className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="타이머 방식">
        {(
          [
            ["pomodoro", "🍅 뽀모도로", "집중과 휴식을 번갈아"],
            ["free", "⏳ 자유 측정", "원하는 만큼 재기"],
          ] as const
        ).map(([id, label, desc]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            onClick={() => setMode(id)}
            className={cn("rounded-2xl border-2 p-3 text-left", mode === id ? "border-primary bg-bg-soft" : "border-line")}
          >
            <span className="font-display block">{label}</span>
            <span className="text-xs text-ink-soft">{desc}</span>
          </button>
        ))}
      </div>

      {mode === "pomodoro" && (
        <div>
          <p className="mb-1.5 text-sm text-ink-soft">집중 / 휴식</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                aria-pressed={preset === i}
                onClick={() => setPreset(i)}
                className={cn("font-display rounded-full border-2 px-3 py-1 text-sm", preset === i ? "border-primary bg-primary text-white" : "border-line")}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm text-ink-soft">과목</p>
        {subjects && <SubjectPicker subjects={subjects} value={subjectId} onChange={setSubjectId} allowNone />}
      </div>

      {todayTasks && todayTasks.length > 0 && (
        <label className="block space-y-1">
          <span className="text-sm text-ink-soft">할 일 연결 (선택)</span>
          <select
            value={task?.id ?? ""}
            onChange={(e) => {
              setTaskId(e.target.value || undefined);
              setSubjectChoice(null);
            }}
            className="w-full rounded-2xl border-2 border-line bg-surface px-3 py-2.5"
          >
            <option value="">연결 안 함</option>
            {todayTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <Button size="lg" className="w-full" onClick={onStart}>
        ▶ 집중 시작
      </Button>

      {notifyState === "default" && (
        <button
          type="button"
          className="w-full text-center text-sm text-ink-soft underline"
          onClick={async () => setNotifyState(await Notification.requestPermission())}
        >
          🔔 다른 앱을 보고 있어도 타이머가 끝나면 알림 받기
        </button>
      )}
    </Card>
  );
}

function Running() {
  const timer = useTimerState();
  const now = useNow(true, 500);
  const pet = usePetState();
  const subjects = useSubjects();
  const subject = subjects?.find((s) => s.id === timer.subjectId);
  const task = useLiveQuery(async () => (timer.taskId ? getDB().tasks.get(timer.taskId) : undefined), [timer.taskId]);
  const isFree = timer.mode === "free" && timer.phase === "focus";
  const len = phaseLength(timer);
  const el = elapsed(timer, now);
  const ms = isFree ? el : remaining(timer, now);
  const progress = isFree ? (el % (60 * 60_000)) / (60 * 60_000) : Math.min(1, el / len);
  const paused = timer.runningSince === null;
  const isBreak = timer.phase === "break";

  async function onStop() {
    const ms = elapsed(timer, Date.now());
    if (timer.phase === "focus" && ms >= 60_000 && !confirm(`지금까지 ${Math.floor(ms / 60_000)}분을 기록하고 끝낼까요?`)) return;
    const r = stop(getTimer(), Date.now());
    setTimer(r.state);
    if (r.completed) await saveFocus(r.completed);
  }

  const R = 92;
  const C = 2 * Math.PI * R;
  const color = isBreak ? "var(--success)" : "var(--primary)";

  return (
    <Card className="flex flex-col items-center gap-3 text-center">
      <p className="font-display text-lg" style={{ color }}>
        {isBreak ? "☕ 휴식 시간" : paused ? "⏸ 잠깐 멈춤" : "🔥 집중하는 중"}
      </p>
      <div className="relative" style={{ width: 220, height: 220 }}>
        <svg viewBox="0 0 220 220" width={220} height={220} className="-rotate-90">
          <circle cx="110" cy="110" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
          <circle
            cx="110"
            cy="110"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            style={{ transition: "stroke-dashoffset 0.5s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-5xl tabular-nums" role="timer" aria-live="off">
            {formatClock(ms)}
          </span>
          {!isFree && <span className="text-xs text-ink-soft">{isBreak ? `휴식 ${timer.breakMin}분` : `집중 ${timer.focusMin}분`}</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <SubjectChip subject={subject} />
        {task && <span className="text-sm text-ink-soft">{task.title}</span>}
      </div>
      {pet && <Pet species={pet.profile.pet.species} stage={pet.stage.stage} mood={isBreak ? "happy" : paused ? "sad" : "excited"} size={80} />}

      <div className="grid w-full grid-cols-2 gap-2">
        {paused ? (
          <Button variant="success" onClick={() => setTimer(resume(getTimer(), Date.now()))}>
            ▶ 계속
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setTimer(pause(getTimer(), Date.now()))}>
            ⏸ 멈춤
          </Button>
        )}
        <Button variant={isBreak ? "primary" : "ghost"} onClick={onStop}>
          {isBreak ? "휴식 건너뛰기" : isFree ? "■ 끝내고 기록" : "■ 그만하기"}
        </Button>
      </div>

      {isBreak && task && !task.done && (
        <Button variant="success" className="w-full" onClick={() => setTaskDone(task.id, true)}>
          ✅ “{task.title}” 완료로 표시
        </Button>
      )}
      {isBreak && <p className="text-sm text-ink-soft">물 한 잔 마시고 스트레칭해요. 휴식이 끝나면 알려줄게요.</p>}
    </Card>
  );
}

function TodaySummary() {
  const today = toDateKey();
  const subjects = useSubjects();
  const sessions = useLiveQuery(() => getDB().studySessions.where("date").equals(today).toArray(), [today]);
  if (!sessions) return null;
  const total = sessions.reduce((s, x) => s + x.focusMinutes, 0);
  return (
    <section>
      <SectionTitle action={<span className="font-display text-primary-deep">{formatMinutes(total)}</span>}>오늘 집중 기록</SectionTitle>
      <Card>
        {sessions.length === 0 ? (
          <Empty icon="🌱">아직 기록이 없어요. 첫 집중을 시작해 볼까요?</Empty>
        ) : (
          <ul className="divide-y-2 divide-line">
            {[...sessions].reverse().map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="tabular-nums text-ink-soft">
                  {new Date(s.startedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <SubjectChip subject={subjects?.find((x) => x.id === s.subjectId)} />
                <span className="ml-auto font-display">{formatMinutes(s.focusMinutes)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
