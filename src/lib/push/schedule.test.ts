import { describe, expect, it } from "vitest";
import { dueReminders, dueRoutineReminders, reminderMessage, routineKey, routineMessage, seoulClock, type SubscriptionState } from "./schedule";

const base: SubscriptionState = {
  settings: { review: "19:00", plan: "16:00", streak: "21:00", style: "noir" },
  lastSent: {},
};
const clock = (hhmm: string, date = "2026-11-11") => {
  const [h, m] = hhmm.split(":").map(Number);
  return { date, minutes: h * 60 + m };
};

describe("dueReminders", () => {
  it("fires at the set time and within 15 minutes", () => {
    expect(dueReminders(base, clock("18:59"))).toEqual([]);
    expect(dueReminders(base, clock("19:00"))).toEqual(["review"]);
    expect(dueReminders(base, clock("19:14"))).toEqual(["review"]);
    expect(dueReminders(base, clock("19:15"))).toEqual([]);
  });
  it("sends once per day", () => {
    expect(dueReminders({ ...base, lastSent: { review: "2026-11-11" } }, clock("19:05"))).toEqual([]);
    expect(dueReminders({ ...base, lastSent: { review: "2026-11-10" } }, clock("19:05"))).toEqual(["review"]);
  });
  it("skips the streak reminder after studying today", () => {
    expect(dueReminders(base, clock("21:00"))).toEqual(["streak"]);
    expect(dueReminders({ ...base, lastStudyDate: "2026-11-11" }, clock("21:00"))).toEqual([]);
  });
  it("respects disabled reminders", () => {
    expect(dueReminders({ ...base, settings: { ...base.settings, plan: null } }, clock("16:00"))).toEqual([]);
  });
});

describe("helpers", () => {
  it("reads Seoul time", () => {
    expect(seoulClock(new Date("2026-11-11T12:30:00Z"))).toEqual({ date: "2026-11-11", minutes: 21 * 60 + 30, weekday: 3 });
    expect(seoulClock(new Date("2026-11-11T15:05:00Z"))).toEqual({ date: "2026-11-12", minutes: 5, weekday: 4 });
  });
  it("has messages for both styles", () => {
    expect(reminderMessage("streak", "noir").url).toBe("/timer");
    expect(reminderMessage("review", "cute").title).toContain("복습");
  });
});

describe("routine reminders", () => {
  const routine = { id: "r1", title: "저녁 수학", time: "20:00", days: [1, 3], minutes: 30 };
  const sub: SubscriptionState = { settings: { ...base.settings, routines: [routine] }, lastSent: {} };
  it("fires on the routine's weekdays at its time, once a day", () => {
    // 2026-11-11은 수요일(3)
    expect(dueRoutineReminders(sub, clock("20:03"))).toEqual([routine]);
    expect(dueRoutineReminders(sub, clock("19:59"))).toEqual([]);
    expect(dueRoutineReminders(sub, clock("20:03", "2026-11-12"))).toEqual([]); // 목요일
    expect(dueRoutineReminders({ ...sub, lastSent: { [routineKey("r1")]: "2026-11-11" } }, clock("20:03"))).toEqual([]);
    expect(routineMessage(routine, "cute").body).toContain("저녁 수학 30분");
  });
});
