/**
 * 집중 타이머 상태 기계 (순수 함수).
 * 시작 시각만 저장하고 남은 시간은 매번 계산하므로, 화면을 벗어나거나 새로고침해도 이어진다.
 */
export type TimerMode = "pomodoro" | "free";
export type TimerPhase = "idle" | "focus" | "break";

export interface TimerState {
  phase: TimerPhase;
  mode: TimerMode;
  focusMin: number;
  breakMin: number;
  subjectId?: string;
  taskId?: string;
  /** 현재 구간이 (다시) 시작된 시각. 일시정지 중이면 null */
  runningSince: number | null;
  /** 일시정지 전까지 쌓인 시간(ms) */
  accumulated: number;
  /** 이번 집중 구간을 처음 시작한 시각 */
  phaseStartedAt: number | null;
  /** 오늘 끝낸 집중 구간 수 */
  cycles: number;
  /** 아직 저장하지 못한 집중 기록 (저장 중 앱이 닫혀도 다음에 이어서 저장) */
  pending?: CompletedFocus[];
}

export interface CompletedFocus {
  startedAt: number;
  endedAt: number;
  minutes: number;
  mode: TimerMode;
  subjectId?: string;
  taskId?: string;
}

export const PRESETS = [
  { label: "25분 / 5분", focusMin: 25, breakMin: 5 },
  { label: "50분 / 10분", focusMin: 50, breakMin: 10 },
  { label: "15분 / 3분", focusMin: 15, breakMin: 3 },
];

export function initialTimer(): TimerState {
  return { phase: "idle", mode: "pomodoro", focusMin: 25, breakMin: 5, runningSince: null, accumulated: 0, phaseStartedAt: null, cycles: 0 };
}

export function elapsed(s: TimerState, now: number): number {
  return s.accumulated + (s.runningSince !== null ? now - s.runningSince : 0);
}

/** 현재 구간 길이(ms). 자유 모드 집중은 끝이 없다. */
export function phaseLength(s: TimerState): number {
  if (s.phase === "focus") return s.mode === "free" ? Infinity : s.focusMin * 60_000;
  if (s.phase === "break") return s.breakMin * 60_000;
  return 0;
}

export function remaining(s: TimerState, now: number): number {
  return Math.max(0, phaseLength(s) - elapsed(s, now));
}

export function start(s: TimerState, now: number, opts: Partial<Pick<TimerState, "mode" | "focusMin" | "breakMin" | "subjectId" | "taskId">> = {}): TimerState {
  return { ...s, ...opts, phase: "focus", runningSince: now, accumulated: 0, phaseStartedAt: now };
}

export function pause(s: TimerState, now: number): TimerState {
  if (s.runningSince === null) return s;
  return { ...s, accumulated: elapsed(s, now), runningSince: null };
}

export function resume(s: TimerState, now: number): TimerState {
  if (s.runningSince !== null || s.phase === "idle") return s;
  return { ...s, runningSince: now };
}

function focusRecord(s: TimerState, endedAt: number, ms: number): CompletedFocus {
  return { startedAt: s.phaseStartedAt ?? endedAt - ms, endedAt, minutes: Math.floor(ms / 60_000), mode: s.mode, subjectId: s.subjectId, taskId: s.taskId };
}

/** 기록할 집중을 대기열에 넣는다 */
export function enqueue(s: TimerState, c?: CompletedFocus): TimerState {
  return c ? { ...s, pending: [...(s.pending ?? []), c] } : s;
}

/** 같은 집중 구간은 늘 같은 id → 두 번 저장되지 않는다 */
export function focusId(c: CompletedFocus): string {
  return `timer-${c.startedAt}`;
}

/** 시간이 다 된 구간을 넘긴다. 집중이 끝나면 기록할 내용을 돌려준다. */
export function tick(s: TimerState, now: number): { state: TimerState; completed?: CompletedFocus } {
  if (s.phase === "idle" || s.runningSince === null) return { state: s };
  const len = phaseLength(s);
  const el = elapsed(s, now);
  if (el < len) return { state: s };
  const endedAt = now - (el - len); // 실제로 끝난 시각
  if (s.phase === "focus") {
    return {
      state: { ...s, phase: "break", runningSince: endedAt, accumulated: 0, phaseStartedAt: endedAt, cycles: s.cycles + 1 },
      completed: focusRecord(s, endedAt, len),
    };
  }
  // 휴식 끝: 다음 집중은 학생이 직접 시작
  return { state: { ...s, phase: "idle", runningSince: null, accumulated: 0, phaseStartedAt: null } };
}

/** 그만하기. 집중 중이었으면 지금까지 한 만큼 기록한다. */
export function stop(s: TimerState, now: number): { state: TimerState; completed?: CompletedFocus } {
  const ms = elapsed(s, now);
  const next: TimerState = { ...s, phase: "idle", runningSince: null, accumulated: 0, phaseStartedAt: null };
  if (s.phase === "focus" && ms >= 60_000) return { state: next, completed: focusRecord(s, now, ms) };
  return { state: next };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
