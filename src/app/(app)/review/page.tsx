"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { PageHeader, useSubjectMap } from "@/components/kit";
import { TaskRow } from "@/components/planner/TaskRow";
import { Card, SectionTitle, buttonStyles } from "@/components/ui";
import { getDB } from "@/lib/db";
import { toDateKey } from "@/lib/date";
import { reviewForecast } from "@/lib/study/memory";
import { useMinuteTick } from "@/lib/timerStore";

export default function ReviewPage() {
  const today = toDateKey();
  const tick = useMinuteTick();
  const subjectMap = useSubjectMap();
  const dueCards = useLiveQuery(() => getDB().cards.where("due").belowOrEqual(Date.now()).count(), [tick]);
  const totalCards = useLiveQuery(() => getDB().cards.count(), []);
  const dueWrong = useLiveQuery(() => getDB().wrongAnswers.where("nextRetry").belowOrEqual(today).filter((w) => !w.mastered).count(), [today]);
  const totalWrong = useLiveQuery(() => getDB().wrongAnswers.count(), []);
  const tomorrow = useLiveQuery(async () => {
    const db = getDB();
    const [cards, wrong, tasks] = await Promise.all([db.cards.toArray(), db.wrongAnswers.toArray(), db.tasks.where("date").aboveOrEqual(today).toArray()]);
    return reviewForecast(cards, wrong, tasks, today, 2)[1].total;
  }, [today]);
  const spaced = useLiveQuery(() => getDB().tasks.where("date").equals(today).filter((t) => t.kind === "spaced").toArray(), [today]);

  return (
    <div className="space-y-5">
      <PageHeader title="🃏 복습" />

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col gap-2">
          <p className="font-display">🃏 플래시카드</p>
          <p className="text-3xl">
            <span className="font-display text-primary-deep">{dueCards ?? 0}</span>
            <span className="text-sm text-ink-soft"> 장 복습</span>
          </p>
          <p className="text-xs text-ink-soft">전체 {totalCards ?? 0}장</p>
          {dueCards ? (
            <Link href="/review/cards/study" className={buttonStyles("primary", "sm", "mt-auto")}>
              지금 복습
            </Link>
          ) : (
            <Link href="/review/cards" className={buttonStyles("ghost", "sm", "mt-auto")}>
              카드 관리
            </Link>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <p className="font-display">📝 오답노트</p>
          <p className="text-3xl">
            <span className="font-display text-danger">{dueWrong ?? 0}</span>
            <span className="text-sm text-ink-soft"> 문제 다시 풀기</span>
          </p>
          <p className="text-xs text-ink-soft">전체 {totalWrong ?? 0}문제</p>
          {dueWrong ? (
            <Link href="/review/wrong/retry" className={buttonStyles("accent", "sm", "mt-auto")}>
              다시 풀기
            </Link>
          ) : (
            <Link href="/review/wrong" className={buttonStyles("ghost", "sm", "mt-auto")}>
              오답노트
            </Link>
          )}
        </Card>
      </div>

      <Link href="/review/map" className="block">
        <Card className="flex items-center gap-3">
          <span aria-hidden className="text-3xl">
            🧠
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display">기억 지도</p>
            <p className="text-sm text-ink-soft">
              {tomorrow === undefined ? "단원별 기억 상태와 복습 예보" : tomorrow > 0 ? `내일 복습 ${tomorrow}개 예정 · 단원별 기억 상태 보기` : "내일은 복습할 것이 없어요 · 단원별 기억 상태 보기"}
            </p>
          </div>
          <span aria-hidden className="text-ink-soft">
            ›
          </span>
        </Card>
      </Link>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Link href="/review/cards" className={buttonStyles("ghost", "md")}>
          카드 묶음 관리
        </Link>
        <Link href="/review/wrong/new" className={buttonStyles("ghost", "md")}>
          + 오답 기록
        </Link>
      </div>

      <section>
        <SectionTitle>오늘의 간격 복습</SectionTitle>
        {spaced && spaced.length > 0 ? (
          <ul className="space-y-2">
            {spaced.map((t) => (
              <TaskRow key={t.id} task={t} subject={t.subjectId ? subjectMap.get(t.subjectId) : undefined} />
            ))}
          </ul>
        ) : (
          <Card className="text-sm text-ink-soft">
            플래너에서 단원 공부를 끝내면 1·3·7·14일 뒤에 복습할 일이 여기에 나타나요. 잊어버릴 때쯤 다시 보면 오래 기억할 수 있어요.
          </Card>
        )}
      </section>
    </div>
  );
}
