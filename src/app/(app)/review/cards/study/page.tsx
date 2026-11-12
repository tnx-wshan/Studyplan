"use client";

import { XP_REWARDS } from "@/lib/game/level";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Empty, PageHeader } from "@/components/kit";
import { Pet } from "@/components/Pet";
import { Button, Card, ProgressBar, buttonStyles } from "@/components/ui";
import { getDB } from "@/lib/db";
import { dueCards, reviewCard } from "@/lib/db/study";
import type { Card as CardT } from "@/lib/db/types";
import { usePetState } from "@/lib/hooks";
import { RATING_LABELS, previewLabel, review, type Rating } from "@/lib/study/srs";

const SESSION_REQUEUE_MS = 20 * 60_000;

export default function StudyPage() {
  return (
    <Suspense fallback={null}>
      <Study />
    </Suspense>
  );
}

function Study() {
  const deckId = useSearchParams().get("deck") ?? undefined;
  const pet = usePetState();
  const [queue, setQueue] = useState<CardT[] | null>(null);
  const [initial, setInitial] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [deckName, setDeckName] = useState<string>();

  useEffect(() => {
    void (async () => {
      const cards = await dueCards(deckId);
      setQueue(cards);
      setInitial(cards.length);
      if (deckId) setDeckName((await getDB().decks.get(deckId))?.name);
    })();
  }, [deckId]);

  const card = queue?.[0];
  const back = deckId ? `/review/cards/deck?id=${deckId}` : "/review";

  async function rate(rating: Rating) {
    if (!card || !queue) return;
    const now = Date.now();
    const next = review(card.srs, rating, now);
    await reviewCard(card.id, rating, now);
    setReviewed((n) => n + 1);
    setFlipped(false);
    const rest = queue.slice(1);
    // 곧 다시 볼 카드(다시·어려움)는 이번 복습의 뒤쪽에 다시 넣는다
    setQueue(next.due - now < SESSION_REQUEUE_MS ? [...rest, { ...card, srs: next.srs, due: next.due }] : rest);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        void rate(Number(e.key) as Rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!queue) return null;

  if (!card) {
    return (
      <div className="space-y-4">
        <PageHeader title="복습 완료" back={back} />
        <Card className="flex flex-col items-center gap-3 py-6 text-center">
          {pet && <Pet species={pet.profile.pet.species} stage={pet.stage.stage} mood="excited" size={120} />}
          {reviewed > 0 ? (
            <>
              <p className="font-display text-2xl">오늘 복습 끝!</p>
              <p className="text-ink-soft">
                카드 {reviewed}번 넘기고 <b className="text-xp-deep">+{reviewed * XP_REWARDS.cardReviewed} XP</b>를 얻었어요.
              </p>
            </>
          ) : (
            <Empty icon="✨">지금 복습할 카드가 없어요.</Empty>
          )}
          <Link href={back} className={buttonStyles("primary", "md")}>
            돌아가기
          </Link>
        </Card>
      </div>
    );
  }

  const left = queue.length;
  return (
    <div className="space-y-4">
      <PageHeader title={deckName ?? "카드 복습"} back={back} action={<span className="font-display text-sm text-ink-soft">남은 카드 {left}</span>} />
      <ProgressBar value={initial ? Math.min(1, reviewed / Math.max(initial, reviewed + left)) : 0} label="복습 진행률" />

      <button
        type="button"
        onClick={() => setFlipped(true)}
        disabled={flipped}
        aria-label={flipped ? undefined : "정답 보기"}
        className="block w-full [perspective:800px]"
      >
        <Card key={`${card.id}-${flipped}`} className="card-flip flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="font-display text-2xl break-words">{card.front}</p>
          {flipped ? (
            <>
              <hr className="w-full border-t-2 border-dashed border-line" />
              <p className="text-xl break-words whitespace-pre-wrap">{card.back}</p>
            </>
          ) : (
            <p className="text-sm text-ink-soft">떠올려 본 다음 눌러서 정답 확인</p>
          )}
        </Card>
      </button>

      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          {([1, 2, 3, 4] as Rating[]).map((r) => (
            <Button key={r} variant={r === 1 ? "ghost" : r === 2 ? "accent" : r === 3 ? "success" : "primary"} className="flex-col gap-0 px-1 py-2" onClick={() => rate(r)}>
              <span>{RATING_LABELS[r]}</span>
              <span className="text-xs opacity-80">{previewLabel(card.srs, r)}</span>
            </Button>
          ))}
        </div>
      ) : (
        <Button size="lg" className="w-full" onClick={() => setFlipped(true)}>
          정답 보기
        </Button>
      )}
      <p className="text-center text-xs text-ink-soft">기억이 잘 날수록 다음 복습까지 간격이 길어져요.</p>
    </div>
  );
}
