/** 알림 종류 */
export type ReminderKind = "review" | "plan" | "streak";

export interface ReminderSettings {
  /** "HH:MM" 또는 null(끔) */
  review: string | null;
  plan: string | null;
  streak: string | null;
  style: "cute" | "noir";
  /** 시작 시각이 있는 고정 루틴 */
  routines?: RoutineReminder[];
}

export interface RoutineReminder {
  id: string;
  title: string;
  time: string;
  /** 요일 (0=일 ~ 6=토) */
  days: number[];
  minutes: number;
}

export interface SubscriptionState {
  settings: ReminderSettings;
  /** 종류별 마지막으로 보낸 날짜 (YYYY-MM-DD, 한국 시간) */
  lastSent: Record<string, string>;
  /** 마지막으로 공부한 날 (앱이 알려줌) */
  lastStudyDate?: string;
}

/** 정해진 시각이 지났지만 15분 안이면 보낸다 (서버가 잠깐 멈췄어도 놓치지 않도록) */
const WINDOW_MIN = 15;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export interface Clock {
  date: string;
  minutes: number;
  /** 요일 (0=일 ~ 6=토). 없으면 날짜로 계산한다 */
  weekday?: number;
}

export function seoulClock(now = new Date()): Required<Clock> {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return { date, minutes: Number(get("hour")) * 60 + Number(get("minute")), weekday: weekdayOf(date) };
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const routineKey = (id: string) => `r:${id}`;

/** 지금 보낼 루틴 알림 */
export function dueRoutineReminders(sub: SubscriptionState, clock: Clock): RoutineReminder[] {
  const weekday = clock.weekday ?? weekdayOf(clock.date);
  return (sub.settings.routines ?? []).filter((r) => {
    if (!r.days.includes(weekday) || sub.lastSent[routineKey(r.id)] === clock.date) return false;
    const diff = clock.minutes - toMinutes(r.time);
    return diff >= 0 && diff < WINDOW_MIN;
  });
}

export function routineMessage(r: RoutineReminder, style: ReminderSettings["style"]): { title: string; body: string; url: string } {
  return style === "noir"
    ? { title: "루틴 시각", body: `${r.title} — ${r.minutes}분. 정해 둔 시간이다.`, url: "/planner" }
    : { title: "루틴 시간이에요 🔁", body: `${r.title} ${r.minutes}분, 지금 시작해 볼까요?`, url: "/planner" };
}

export function dueReminders(sub: SubscriptionState, clock: Clock): ReminderKind[] {
  const due: ReminderKind[] = [];
  for (const kind of ["review", "plan", "streak"] as ReminderKind[]) {
    const at = sub.settings[kind];
    if (!at || sub.lastSent[kind] === clock.date) continue;
    const diff = clock.minutes - toMinutes(at);
    if (diff < 0 || diff >= WINDOW_MIN) continue;
    // 오늘 이미 공부했으면 연속 학습 알림은 보내지 않는다
    if (kind === "streak" && sub.lastStudyDate === clock.date) continue;
    due.push(kind);
  }
  return due;
}

export function reminderMessage(kind: ReminderKind, style: ReminderSettings["style"]): { title: string; body: string; url: string } {
  const noir = style === "noir";
  switch (kind) {
    case "review":
      return { title: noir ? "복습 시각" : "복습할 시간이에요 🃏", body: noir ? "잊히기 전에 다시 꺼내 볼 기록이 있다." : "오늘의 복습 카드와 오답을 확인해 보세요.", url: "/review" };
    case "plan":
      return { title: noir ? "계획 개시" : "오늘 계획을 시작해요 🗓️", body: noir ? "오늘의 의뢰를 확인하고 첫 번째 일에 착수하자." : "오늘 할 일을 확인하고 첫 번째부터 시작해 볼까요?", url: "/planner" };
    case "streak":
      return { title: noir ? "기록이 끊기기 직전" : "연속 기록을 지켜요 🔥", body: noir ? "오늘은 아직 아무것도 기록되지 않았다. 10분이면 충분하다." : "오늘 아직 공부 기록이 없어요. 10분만 해도 연속 기록이 이어져요!", url: "/timer" };
  }
}
