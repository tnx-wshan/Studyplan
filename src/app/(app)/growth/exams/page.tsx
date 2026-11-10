"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { Empty, PageHeader, formatDateKey, useSubjectMap } from "@/components/kit";
import { Card, SectionTitle, cn } from "@/components/ui";
import { getDB } from "@/lib/db";
import type { Subject } from "@/lib/db/types";
import { toDateKey } from "@/lib/date";
import { examTrend, goalsMet, type TrendSeries } from "@/lib/study/examTrend";

export default function ExamsPage() {
  const today = toDateKey();
  const subjectMap = useSubjectMap();
  const exams = useLiveQuery(async () => (await getDB().exams.toArray()).sort((a, b) => b.date.localeCompare(a.date)), []);
  if (!exams) return null;
  const past = exams.filter((e) => e.date <= today);
  const trend = examTrend(exams);

  return (
    <div className="space-y-5">
      <PageHeader title="📈 시험 성적" back="/growth" />

      <section>
        <SectionTitle>과목별 점수 변화</SectionTitle>
        <Card>
          {trend.length === 0 ? (
            <Empty icon="📈">시험이 끝난 뒤 결과를 기록하면 여기에 점수 변화가 그려져요.</Empty>
          ) : (
            <TrendChart series={trend} subjectMap={subjectMap} />
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>지난 시험</SectionTitle>
        {past.length === 0 ? (
          <Card>
            <Empty icon="📝">아직 끝난 시험이 없어요.</Empty>
          </Card>
        ) : (
          <ul className="space-y-2">
            {past.map((e) => {
              const met = goalsMet(e);
              return (
                <li key={e.id}>
                  <Link href={`/planner/exam?id=${e.id}`}>
                    <Card className="space-y-1 p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-display truncate">{e.title}</span>
                        <span className="shrink-0 text-xs text-ink-soft">{formatDateKey(e.date)}</span>
                      </div>
                      {e.results ? (
                        <p className="text-sm">
                          {Object.entries(e.results)
                            .map(([id, s]) => `${subjectMap.get(id)?.name ?? "과목"} ${s}`)
                            .join(" · ")}
                          {met.total > 0 && <span className="ml-2 text-xs text-ink-soft">목표 {met.met}/{met.total}</span>}
                        </p>
                      ) : (
                        <p className="text-sm text-primary-deep">결과를 기록해 보세요 →</p>
                      )}
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** 과목별 점수 꺾은선. 점을 누르면 값이 보이고, 아래 표로도 볼 수 있다. */
function TrendChart({ series, subjectMap }: { series: TrendSeries[]; subjectMap: Map<string, Subject> }) {
  const [active, setActive] = useState<string | null>(null);
  // x축: 결과가 있는 시험들을 날짜순으로
  const exams = [...new Map(series.flatMap((s) => s.points).map((p) => [p.examId, p])).values()].sort((a, b) => a.date.localeCompare(b.date));
  const W = 320;
  const H = 180;
  const pad = { l: 28, r: 44, t: 12, b: 26 };
  const x = (examId: string) => {
    const i = exams.findIndex((e) => e.examId === examId);
    return exams.length === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i / (exams.length - 1)) * (W - pad.l - pad.r);
  };
  const y = (score: number) => pad.t + (1 - score / 100) * (H - pad.t - pad.b);
  // 선 끝 이름표: 점수가 비슷하면 겹치므로 위에서부터 최소 간격(11)을 두고 밀어낸다
  const labelY = new Map<string, number>();
  let prevY = -Infinity;
  for (const item of series.map((s) => ({ id: s.subjectId, y: y(s.points.at(-1)!.score) + 3 })).sort((a, b) => a.y - b.y)) {
    prevY = Math.max(item.y, prevY + 11);
    labelY.set(item.id, prevY);
  }
  const shown = series.flatMap((s) => s.points.map((p) => ({ ...p, subjectId: s.subjectId }))).find((p) => `${p.subjectId}:${p.examId}` === active);

  return (
    <div>
      <div className="mb-1 h-5 text-right text-xs" aria-live="polite">
        {shown && (
          <span className="font-display">
            {subjectMap.get(shown.subjectId)?.name} · {shown.title} {shown.score}점{shown.goal !== undefined ? ` (목표 ${shown.goal})` : ""}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="과목별 시험 점수 변화 그래프">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" strokeDasharray={v === 0 ? undefined : "3 3"} />
            <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--ink-soft)">
              {v}
            </text>
          </g>
        ))}
        {exams.map((e) => (
          <text key={e.examId} x={x(e.examId)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--ink-soft)">
            {e.title.slice(0, 6)}
          </text>
        ))}
        {series.map((s) => {
          const color = subjectMap.get(s.subjectId)?.color ?? "var(--ink-soft)";
          const last = s.points.at(-1)!;
          return (
            <g key={s.subjectId} style={{ ["--c" as string]: color }}>
              <polyline points={s.points.map((p) => `${x(p.examId)},${y(p.score)}`).join(" ")} fill="none" className="mark-stroke" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p) => {
                const key = `${s.subjectId}:${p.examId}`;
                return (
                  <g key={key}>
                    <circle cx={x(p.examId)} cy={y(p.score)} r={active === key ? 6 : 4.5} className="mark-fill" stroke="var(--surface)" strokeWidth="2" />
                    {/* 누르기 쉬운 넓은 영역 */}
                    <circle
                      cx={x(p.examId)}
                      cy={y(p.score)}
                      r="14"
                      fill="transparent"
                      tabIndex={0}
                      role="button"
                      aria-label={`${subjectMap.get(s.subjectId)?.name ?? "과목"} ${p.title} ${p.score}점`}
                      onMouseEnter={() => setActive(key)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(key)}
                      onBlur={() => setActive(null)}
                      onClick={() => setActive(active === key ? null : key)}
                    />
                  </g>
                );
              })}
              <text x={x(last.examId) + 8} y={labelY.get(s.subjectId)} fontSize="10" fill="var(--ink)">
                {subjectMap.get(s.subjectId)?.name ?? "과목"}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {series.map((s) => (
          <li key={s.subjectId} className="flex items-center gap-1">
            <span className="mark inline-block size-2.5 rounded-full" style={{ ["--c" as string]: subjectMap.get(s.subjectId)?.color ?? "var(--ink-soft)" }} />
            {subjectMap.get(s.subjectId)?.name ?? "과목"}
            {s.change !== null && <span className={cn("tabular-nums", s.change >= 0 ? "text-success-deep" : "text-danger")}>{s.change >= 0 ? `+${s.change}` : s.change}</span>}
          </li>
        ))}
      </ul>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-soft">표로 보기</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-xs text-ink-soft">
              <th className="py-1 font-normal">과목</th>
              {exams.map((e) => (
                <th key={e.examId} className="py-1 text-right font-normal">
                  {e.title.slice(0, 6)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.subjectId} className="border-t border-line">
                <td className="py-1">{subjectMap.get(s.subjectId)?.name ?? "과목"}</td>
                {exams.map((e) => {
                  const p = s.points.find((x) => x.examId === e.examId);
                  return (
                    <td key={e.examId} className="py-1 text-right tabular-nums">
                      {p ? `${p.score}${p.goal !== undefined ? ` / ${p.goal}` : ""}` : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-ink-soft">점수 / 목표</p>
      </details>
    </div>
  );
}
