import { addDays, parseDateKey, toDateKey } from "@/lib/date";

/** ISO 주 키 (월요일 시작): 2026-W46 */
export function weekKey(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const dow = (d.getDay() + 6) % 7; // 월=0
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const jan4Dow = (jan4.getDay() + 6) % 7;
  const week1Monday = new Date(year, 0, 4 - jan4Dow);
  const week = Math.round((thursday.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export interface Period {
  kind: "week" | "month";
  key: string;
  /** 시작일 (포함) */
  start: string;
  /** 끝 다음 날 (미포함) */
  end: string;
  label: string;
}

export function weekPeriod(key: string): Period {
  const [y, w] = key.split("-W").map(Number);
  const jan4 = new Date(y, 0, 4);
  const monday = new Date(y, 0, 4 - ((jan4.getDay() + 6) % 7) + (w - 1) * 7);
  const start = toDateKey(monday);
  const end = addDays(start, 7);
  const last = parseDateKey(addDays(end, -1));
  return { kind: "week", key, start, end, label: `${monday.getMonth() + 1}월 ${monday.getDate()}일 ~ ${last.getMonth() + 1}월 ${last.getDate()}일` };
}

export function monthPeriod(key: string): Period {
  const [y, m] = key.split("-").map(Number);
  const start = toDateKey(new Date(y, m - 1, 1));
  const end = toDateKey(new Date(y, m, 1));
  return { kind: "month", key, start, end, label: `${y}년 ${m}월` };
}

export function periodFor(kind: "week" | "month", dateKey: string): Period {
  return kind === "week" ? weekPeriod(weekKey(dateKey)) : monthPeriod(dateKey.slice(0, 7));
}

/** 바로 앞(-1)·뒤(+1) 기간 */
export function shiftPeriod(p: Period, delta: number): Period {
  if (p.kind === "week") return weekPeriod(weekKey(addDays(p.start, delta * 7)));
  const d = parseDateKey(p.start);
  return monthPeriod(toDateKey(new Date(d.getFullYear(), d.getMonth() + delta, 1)).slice(0, 7));
}

export function inPeriod(dateKey: string, p: Pick<Period, "start" | "end">) {
  return dateKey >= p.start && dateKey < p.end;
}
