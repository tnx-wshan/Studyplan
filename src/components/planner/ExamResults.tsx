"use client";

import { useState } from "react";
import { Field, TextArea } from "../kit";
import { toast } from "../Toaster";
import { Button, Card, SectionTitle, cn } from "../ui";
import { saveExamResult, setExamGoals } from "@/lib/db/study";
import type { Exam, Subject } from "@/lib/db/types";
import { goalsMet } from "@/lib/study/examTrend";

type Scores = Record<string, string>;
const toNumbers = (s: Scores) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.trim() === "" ? undefined : Number(v)]));
const fromNumbers = (n?: Record<string, number>): Scores => Object.fromEntries(Object.entries(n ?? {}).map(([k, v]) => [k, String(v)]));

function ScoreInputs({ exam, subjectMap, value, onChange, hint }: { exam: Exam; subjectMap: Map<string, Subject>; value: Scores; onChange: (s: Scores) => void; hint?: (id: string) => string | undefined }) {
  return (
    <div className="space-y-2">
      {exam.ranges.map((r) => {
        const s = subjectMap.get(r.subjectId);
        return (
          <label key={r.subjectId} className="flex items-center gap-3">
            <span className="inline-block size-3 shrink-0 rounded-full" style={{ background: s?.color }} />
            <span className="flex-1 text-sm">
              {s?.name ?? "과목"}
              {hint?.(r.subjectId) && <span className="ml-2 text-xs text-ink-soft">{hint(r.subjectId)}</span>}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={value[r.subjectId] ?? ""}
              onChange={(e) => onChange({ ...value, [r.subjectId]: e.target.value })}
              aria-label={`${s?.name ?? "과목"} 점수`}
              placeholder="-"
              className="w-20 rounded-xl border-2 border-line bg-surface px-2 py-1.5 text-right tabular-nums outline-none focus:border-accent"
            />
            <span className="text-sm text-ink-soft">점</span>
          </label>
        );
      })}
    </div>
  );
}

/** 시험 전: 목표 점수 / 시험 뒤: 결과와 돌아보기 */
export function ExamResults({ exam, subjectMap, dday }: { exam: Exam; subjectMap: Map<string, Subject>; dday: number }) {
  return dday > 0 ? <GoalEditor key={`g-${exam.updatedAt}`} exam={exam} subjectMap={subjectMap} /> : <ResultEditor key={`r-${exam.resultAt ?? 0}`} exam={exam} subjectMap={subjectMap} />;
}

function GoalEditor({ exam, subjectMap }: { exam: Exam; subjectMap: Map<string, Subject> }) {
  const [goals, setGoals] = useState<Scores>(() => fromNumbers(exam.goals));
  const dirty = JSON.stringify(fromNumbers(exam.goals)) !== JSON.stringify(Object.fromEntries(Object.entries(goals).filter(([, v]) => v.trim() !== "")));
  return (
    <section>
      <SectionTitle>🎯 목표 점수</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-ink-soft">지난 점수보다 조금 높게, 닿을 수 있는 목표가 좋아요. 시험이 끝나면 결과와 비교해 볼 수 있어요.</p>
        <ScoreInputs exam={exam} subjectMap={subjectMap} value={goals} onChange={setGoals} />
        {dirty && (
          <Button
            size="sm"
            className="w-full"
            onClick={async () => {
              await setExamGoals(exam.id, toNumbers(goals));
              toast("목표 점수를 저장했어요");
            }}
          >
            목표 저장
          </Button>
        )}
      </Card>
    </section>
  );
}

function ResultEditor({ exam, subjectMap }: { exam: Exam; subjectMap: Map<string, Subject> }) {
  const [editing, setEditing] = useState(!exam.results);
  const [scores, setScores] = useState<Scores>(() => fromNumbers(exam.results));
  const [worked, setWorked] = useState(exam.resultNote?.worked ?? "");
  const [change, setChange] = useState(exam.resultNote?.change ?? "");
  const filled = Object.values(scores).some((v) => v.trim() !== "");

  if (!editing && exam.results) {
    const met = goalsMet(exam);
    return (
      <section>
        <SectionTitle
          action={
            <button type="button" className="text-sm text-ink-soft underline" onClick={() => setEditing(true)}>
              고치기
            </button>
          }
        >
          📊 시험 결과
        </SectionTitle>
        <Card className="space-y-3">
          <ul className="space-y-2">
            {Object.entries(exam.results).map(([id, score]) => {
              const goal = exam.goals?.[id];
              const diff = goal !== undefined ? score - goal : null;
              return (
                <li key={id} className="flex items-center gap-3 text-sm">
                  <span className="inline-block size-3 rounded-full" style={{ background: subjectMap.get(id)?.color }} />
                  <span className="flex-1">{subjectMap.get(id)?.name ?? "과목"}</span>
                  {goal !== undefined && <span className="text-xs text-ink-soft">목표 {goal}</span>}
                  <span className="font-display w-12 text-right text-lg tabular-nums">{score}</span>
                  {diff !== null && <span className={cn("w-10 text-right text-xs tabular-nums", diff >= 0 ? "text-success-deep" : "text-danger")}>{diff >= 0 ? `+${diff}` : diff}</span>}
                </li>
              );
            })}
          </ul>
          {met.total > 0 && <p className="text-sm">{met.met === met.total ? "목표를 모두 이뤘어요! 🎉" : `목표 ${met.total}과목 중 ${met.met}과목 달성. 점수보다 다음에 바꿀 한 가지가 더 중요해요.`}</p>}
          {exam.resultNote?.worked && <p className="text-sm">👍 {exam.resultNote.worked}</p>}
          {exam.resultNote?.change && <p className="text-sm">🔧 {exam.resultNote.change}</p>}
        </Card>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle>📊 시험 결과 기록</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-ink-soft">점수는 이 기기에만 저장돼요. 아직 안 나온 과목은 비워 두세요.</p>
        <ScoreInputs exam={exam} subjectMap={subjectMap} value={scores} onChange={setScores} hint={(id) => (exam.goals?.[id] !== undefined ? `목표 ${exam.goals[id]}` : undefined)} />
        <Field label="이번에 효과가 있었던 공부법 👍">
          <TextArea rows={2} value={worked} onChange={(e) => setWorked(e.target.value)} maxLength={300} placeholder="예: 백지 복습을 단원마다 두 번씩 했다" />
        </Field>
        <Field label="다음 시험에서 바꿀 한 가지 🔧">
          <TextArea rows={2} value={change} onChange={(e) => setChange(e.target.value)} maxLength={300} placeholder="예: 오답을 시험 전 주가 아니라 그때그때 다시 풀기" />
        </Field>
        <Button
          className="w-full"
          disabled={!filled}
          onClick={async () => {
            const xp = await saveExamResult(exam.id, toNumbers(scores), { worked, change });
            toast(xp ? `시험 결과 기록 완료! +${xp} XP` : "시험 결과를 고쳤어요");
            setEditing(false);
          }}
        >
          {exam.results ? "저장" : "결과 저장 (+30 XP)"}
        </Button>
      </Card>
    </section>
  );
}
