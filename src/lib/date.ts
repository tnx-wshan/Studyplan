/** 기기 시간대 기준 YYYY-MM-DD */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** b - a (일 단위) */
export function daysBetween(a: string, b: string): number {
  const ms = parseDateKey(b).getTime() - parseDateKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function addDays(key: string, n: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}
