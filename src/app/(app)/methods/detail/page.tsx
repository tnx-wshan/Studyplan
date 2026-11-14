"use client";

import { XP_REWARDS } from "@/lib/game/level";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Empty, PageHeader, formatDateKey } from "@/components/kit";
import { EvidenceBadge } from "@/components/methods/MethodCard";
import { Card, SectionTitle, buttonStyles } from "@/components/ui";
import { SUBJECT_GROUPS } from "@/data/curriculum";
import { methodById } from "@/data/methods";
import { getDB } from "@/lib/db";

export default function MethodDetailPage() {
  return (
    <Suspense fallback={null}>
      <Detail />
    </Suspense>
  );
}

function Detail() {
  const id = useSearchParams().get("id") ?? "";
  const method = methodById(id);
  const logs = useLiveQuery(() => getDB().methodLogs.where("methodId").equals(id).reverse().sortBy("createdAt"), [id]);

  if (!method) {
    return (
      <>
        <PageHeader title="학습법" back="/methods" />
        <Card>
          <Empty icon="🔍">학습법을 찾을 수 없어요.</Empty>
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title={`${method.icon} ${method.name}`} back="/methods" />
      <Card className="space-y-3">
        <p className="font-display text-lg text-primary-deep">“{method.oneLine}”</p>
        <p>{method.description}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
          <EvidenceBadge level={method.evidence} />
          <span>⏱️ 약 {method.minutes}분</span>
          <span>· {method.subjects.length ? SUBJECT_GROUPS.filter((g) => method.subjects.includes(g.id)).map((g) => g.label).join(", ") + "에 특히 좋아요" : "모든 과목"}</span>
        </div>
      </Card>

      <section>
        <SectionTitle>왜 효과가 있나요?</SectionTitle>
        <Card className="text-sm leading-relaxed">{method.why}</Card>
      </section>

      <section>
        <SectionTitle>이렇게 해요</SectionTitle>
        <Card>
          <ol className="space-y-2">
            {method.steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm">
                <span className="font-display flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-white">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <Card className="space-y-1 bg-xp/10 text-sm">
        <p className="font-display">✨ 꿀팁</p>
        {method.tips.map((t) => (
          <p key={t}>• {t}</p>
        ))}
      </Card>

      <div className="space-y-2">
        <Link href={`/methods/practice?id=${method.id}`} className={buttonStyles("primary", "lg", "w-full")}>
          ▶ 지금 해보기 (+{XP_REWARDS.methodPractice} XP)
        </Link>
        {method.links?.map((l) => (
          <Link key={l.href} href={l.href} className={buttonStyles("ghost", "md", "w-full")}>
            {l.label}
          </Link>
        ))}
      </div>

      <section>
        <SectionTitle>내 실습 기록</SectionTitle>
        {logs && logs.length > 0 ? (
          <ul className="space-y-2">
            {logs.slice(0, 10).map((l) => (
              <li key={l.id}>
                <Card className="space-y-1 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display truncate">{l.topic || "주제 없음"}</span>
                    <span className="shrink-0 text-xs text-ink-soft">{formatDateKey(l.date)}</span>
                  </div>
                  {l.recall !== undefined && <p className="text-xs text-ink-soft">떠올린 핵심 {l.recall}%</p>}
                  {l.aiFeedback && <p className="text-xs text-ink-soft">AI 이해도 {l.aiFeedback.score}점 · {l.aiFeedback.nextStep}</p>}
                  {Object.entries(l.fields)
                    .filter(([, v]) => v)
                    .slice(0, 1)
                    .map(([k, v]) => (
                      <p key={k} className="line-clamp-2 whitespace-pre-wrap text-ink-soft">
                        {v}
                      </p>
                    ))}
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <Empty icon="🌱">아직 해 본 적이 없어요. 오늘 한 번 해볼까요?</Empty>
          </Card>
        )}
      </section>
    </div>
  );
}
