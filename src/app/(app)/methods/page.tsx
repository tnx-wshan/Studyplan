"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/kit";
import { MethodCard } from "@/components/methods/MethodCard";
import { Card, ProgressBar, SectionTitle, buttonStyles, cn } from "@/components/ui";
import { DIMENSIONS, recommendedMethods, weakDimensions, type Dimension } from "@/data/diagnosis";
import { METHODS, SITUATIONS, sortForSubject } from "@/data/methods";
import { SUBJECT_GROUPS, type SubjectGroup } from "@/data/curriculum";
import { useProfile } from "@/lib/hooks";

export default function MethodsPage() {
  const profile = useProfile();
  const [situationId, setSituationId] = useState<string | null>(null);
  const [group, setGroup] = useState<SubjectGroup | undefined>();
  const situation = SITUATIONS.find((s) => s.id === situationId);
  const diagnosis = profile?.diagnosis;
  const scores = diagnosis?.scores as Record<Dimension, number> | undefined;
  const weak = scores ? weakDimensions(scores) : [];
  const library = group ? METHODS.filter((m) => m.subjects.length === 0 || m.subjects.includes(group)) : METHODS;

  return (
    <div className="space-y-5">
      <PageHeader title="💡 학습법" />

      <section>
        <SectionTitle>지금 어떤 상황인가요?</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {SITUATIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={situationId === s.id}
              onClick={() => setSituationId(situationId === s.id ? null : s.id)}
              className={cn("rounded-2xl border-2 px-3 py-1.5 text-sm", situationId === s.id ? "border-accent bg-accent text-white" : "border-line bg-surface")}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
        {situation && (
          <div className="mt-3 space-y-2">
            <Card className="border-accent bg-accent/5 text-sm">💡 {situation.advice}</Card>
            <SubjectFilter value={group} onChange={setGroup} />
            {sortForSubject(situation.methods, group).map((m) => (
              <MethodCard key={m.id} method={m} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          action={
            diagnosis && (
              <Link href="/methods/diagnosis" className="text-sm text-ink-soft underline">
                다시 진단
              </Link>
            )
          }
        >
          내 공부 습관
        </SectionTitle>
        {scores ? (
          <Card className="space-y-3">
            <ul className="space-y-2">
              {(Object.keys(DIMENSIONS) as Dimension[]).map((d) => (
                <li key={d} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm">
                  <span>
                    {DIMENSIONS[d].icon} {DIMENSIONS[d].label}
                  </span>
                  <ProgressBar value={scores[d] / 100} className="h-3" color={weak.includes(d) ? "var(--primary)" : "var(--success)"} label={`${DIMENSIONS[d].label} 점수`} />
                  <span className="text-right tabular-nums">{scores[d]}</span>
                </li>
              ))}
            </ul>
            {weak.length > 0 ? (
              <p className="text-sm">
                보완하면 좋은 습관: <b className="font-display">{weak.map((d) => DIMENSIONS[d].label).join(", ")}</b>
              </p>
            ) : (
              <p className="text-sm">공부 습관이 아주 좋아요! 효과가 가장 잘 알려진 방법으로 더 단단하게 만들어 봐요.</p>
            )}
            <div className="space-y-2">
              {recommendedMethods(scores)
                .slice(0, 3)
                .map((id) => METHODS.find((m) => m.id === id)!)
                .map((m) => (
                  <MethodCard key={m.id} method={m} compact />
                ))}
            </div>
          </Card>
        ) : (
          <Card className="flex items-center gap-3">
            <span aria-hidden className="text-3xl">
              🩺
            </span>
            <div className="flex-1">
              <p className="font-display">2분 공부 습관 진단</p>
              <p className="text-sm text-ink-soft">12개 질문에 답하면 나에게 맞는 학습법을 추천해 줘요.</p>
            </div>
            <Link href="/methods/diagnosis" className={buttonStyles("primary", "sm")}>
              시작
            </Link>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>모든 학습법</SectionTitle>
        <div className="mb-2">
          <SubjectFilter value={group} onChange={setGroup} />
        </div>
        <div className="space-y-2">
          {library.map((m) => (
            <MethodCard key={m.id} method={m} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SubjectFilter({ value, onChange }: { value?: SubjectGroup; onChange: (g?: SubjectGroup) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="과목">
      {[{ id: undefined, label: "모든 과목" }, ...SUBJECT_GROUPS.map((g) => ({ id: g.id, label: g.label }))].map((g) => (
        <button
          key={g.label}
          type="button"
          role="radio"
          aria-checked={value === g.id}
          onClick={() => onChange(g.id)}
          className={cn("font-display rounded-full border-2 px-3 py-1 text-xs", value === g.id ? "border-ink bg-ink text-bg" : "border-line")}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}
