import { addDays, toDateKey } from "@/lib/date";

/** 최근 몇 주간의 공부 기록 잔디 */
export function StudyGrass({ days, weeks = 8 }: { days: Set<string>; weeks?: number }) {
  const today = toDateKey();
  const todayDow = new Date().getDay(); // 0=일
  const start = addDays(today, -(weeks * 7 - 1) - (6 - todayDow));
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i + (6 - todayDow)));
  // 열 = 주, 행 = 요일
  const columns = Array.from({ length: weeks }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const studied = cells.filter((d) => days.has(d)).length;
  return (
    <div>
      <div className="flex gap-1" role="img" aria-label={`최근 ${weeks}주 중 ${studied}일 공부함`}>
        {columns.map((col, i) => (
          <div key={i} className="flex flex-1 flex-col gap-1">
            {col.map((d) => (
              <div
                key={d}
                title={d}
                className="aspect-square w-full rounded-[4px]"
                style={{
                  background: d > today ? "transparent" : days.has(d) ? "var(--success)" : "var(--surface-2)",
                  outline: d === today ? "2px solid var(--primary)" : undefined,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
