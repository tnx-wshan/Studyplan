import { describe, expect, it } from "vitest";
import { formatClock, initialTimer, pause, remaining, resume, start, startQuick, stop, tick } from "./timer";

const M = 60_000;

describe("timer", () => {
  it("counts down and survives pause/resume", () => {
    let s = start(initialTimer(), 0, { focusMin: 25 });
    expect(remaining(s, 10 * M)).toBe(15 * M);
    s = pause(s, 10 * M);
    expect(remaining(s, 60 * M)).toBe(15 * M);
    s = resume(s, 60 * M);
    expect(remaining(s, 65 * M)).toBe(10 * M);
  });

  it("completes focus at the real end time even if checked late, then breaks", () => {
    const s = start(initialTimer(), 0, { focusMin: 25, breakMin: 5, subjectId: "m" });
    const r = tick(s, 27 * M);
    expect(r.completed).toMatchObject({ startedAt: 0, endedAt: 25 * M, minutes: 25, subjectId: "m" });
    expect(r.state.phase).toBe("break");
    expect(remaining(r.state, 27 * M)).toBe(3 * M);
    const after = tick(r.state, 31 * M);
    expect(after.state.phase).toBe("idle");
    expect(after.completed).toBeUndefined();
  });

  it("does nothing before time is up", () => {
    const s = start(initialTimer(), 0);
    expect(tick(s, 24 * M).completed).toBeUndefined();
  });

  it("records partial focus on stop, ignores under a minute", () => {
    const s = start(initialTimer(), 0);
    expect(stop(s, 12.5 * M).completed?.minutes).toBe(12);
    expect(stop(s, 30_000).completed).toBeUndefined();
  });

  it("free mode never auto-completes", () => {
    const s = start(initialTimer(), 0, { mode: "free" });
    expect(tick(s, 500 * M).completed).toBeUndefined();
    expect(stop(s, 90 * M).completed?.minutes).toBe(90);
  });

  it("formats the clock", () => {
    expect(formatClock(25 * M)).toBe("25:00");
    expect(formatClock(61_500)).toBe("01:02");
  });

  it("quick start ends after 5 minutes without a break and asks to continue", () => {
    const s = startQuick(initialTimer(), 0, "m");
    expect(remaining(s, 0)).toBe(5 * M);
    const r = tick(s, 6 * M);
    expect(r.completed).toMatchObject({ minutes: 5, endedAt: 5 * M, subjectId: "m" });
    expect(r.state).toMatchObject({ phase: "idle", quickDone: true, quick: false });
    // 이어서 시작하면 묻는 상태가 사라진다
    expect(start(r.state, 7 * M, { focusMin: 25, breakMin: 5 })).toMatchObject({ quickDone: false, quick: false, phase: "focus" });
  });
});
