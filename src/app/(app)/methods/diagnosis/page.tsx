"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/kit";
import { MethodCard } from "@/components/methods/MethodCard";
import { Pet } from "@/components/Pet";
import { Button, Card, ProgressBar, buttonStyles, cn } from "@/components/ui";
import { DIMENSIONS, QUESTIONS, SCALE, recommendedMethods, weakDimensions, type Answers, type Dimension } from "@/data/diagnosis";
import { methodById } from "@/data/methods";
import { saveDiagnosis } from "@/lib/db/coaching";
import { withEulReul } from "@/lib/korean";
import { usePetState } from "@/lib/hooks";

export default function DiagnosisPage() {
  const pet = usePetState();
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<Record<Dimension, number> | null>(null);
  const q = QUESTIONS[index];

  async function choose(value: number) {
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (index < QUESTIONS.length - 1) setIndex(index + 1);
    else setScores((await saveDiagnosis(next)) as Record<Dimension, number>);
  }

  if (scores) {
    const weak = weakDimensions(scores);
    return (
      <div className="space-y-4">
        <PageHeader title="🩺 진단 결과" back="/methods" />
        <Card className="flex flex-col items-center gap-2 text-center">
          {pet && <Pet species={pet.profile.pet.species} stage={pet.stage.stage} mood="excited" size={100} />}
          <p className="font-display text-lg">{weak.length ? `${withEulReul(weak.map((d) => DIMENSIONS[d].label).join(", "))} 키워 봐요!` : "공부 습관이 아주 좋아요!"}</p>
          <p className="text-sm text-ink-soft">이 결과는 “어떤 유형인지”가 아니라 지금 습관에서 보완할 점이에요. 습관은 연습하면 바뀌어요.</p>
        </Card>
        <Card>
          <ul className="space-y-3">
            {(Object.keys(DIMENSIONS) as Dimension[]).map((d) => (
              <li key={d} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>
                    {DIMENSIONS[d].icon} {DIMENSIONS[d].label}
                  </span>
                  <span className="font-display tabular-nums">{scores[d]}</span>
                </div>
                <ProgressBar value={scores[d] / 100} className="h-3" color={weak.includes(d) ? "var(--primary)" : "var(--success)"} label={`${DIMENSIONS[d].label} 점수`} />
                {weak.includes(d) && <p className="text-xs text-ink-soft">{DIMENSIONS[d].low}</p>}
              </li>
            ))}
          </ul>
        </Card>
        <p className="font-display">추천 학습법</p>
        <div className="space-y-2">
          {recommendedMethods(scores)
            .slice(0, 4)
            .map((id) => methodById(id)!)
            .map((m) => (
              <MethodCard key={m.id} method={m} />
            ))}
        </div>
        <Link href="/methods" className={buttonStyles("ghost", "md", "w-full")}>
          학습법으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="🩺 공부 습관 진단" back="/methods" />
      <div className="flex items-center gap-2">
        <ProgressBar value={index / QUESTIONS.length} color="var(--accent)" label="진단 진행률" />
        <span className="font-display shrink-0 text-sm tabular-nums">
          {index + 1}/{QUESTIONS.length}
        </span>
      </div>
      <Card className="space-y-4 py-6">
        <p className="text-xs text-ink-soft">
          {DIMENSIONS[q.dimension].icon} {DIMENSIONS[q.dimension].label}
        </p>
        <p className="font-display text-xl leading-snug">{q.text}</p>
        <div className="space-y-2" role="radiogroup" aria-label="응답">
          {SCALE.map((label, i) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={answers[q.id] === i + 1}
              onClick={() => choose(i + 1)}
              className={cn("w-full rounded-2xl border-2 px-4 py-3 text-left", answers[q.id] === i + 1 ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-accent")}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>
      {index > 0 && (
        <Button variant="ghost" className="w-full" onClick={() => setIndex(index - 1)}>
          이전 질문
        </Button>
      )}
      <p className="text-center text-xs text-ink-soft">정답은 없어요. 요즘의 나를 떠올리며 솔직하게 골라 주세요.</p>
    </div>
  );
}
