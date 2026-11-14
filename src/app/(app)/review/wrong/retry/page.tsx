"use client";

import { XP_REWARDS } from "@/lib/game/level";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Empty, PageHeader, SubjectChip, useSubjectMap } from "@/components/kit";
import { Markdown } from "@/components/Markdown";
import { Pet } from "@/components/Pet";
import { StoredImage } from "@/components/StoredImage";
import { toast } from "@/components/Toaster";
import { Button, Card, ProgressBar, buttonStyles } from "@/components/ui";
import { dueWrongAnswers, retryWrongAnswer } from "@/lib/db/study";
import type { WrongAnswer } from "@/lib/db/types";
import { usePetState } from "@/lib/hooks";
import { MASTER_STREAK } from "@/lib/study/retry";
import { WRONG_REASONS } from "@/lib/study/wrongReasons";

export default function RetryPage() {
  const pet = usePetState();
  const subjectMap = useSubjectMap();
  const [queue, setQueue] = useState<WrongAnswer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    void dueWrongAnswers().then((xs) => {
      setQueue(xs);
      setTotal(xs.length);
    });
  }, []);

  if (!queue) return null;
  const item = queue[0];

  async function answer(correct: boolean) {
    if (!item) return;
    await retryWrongAnswer(item.id, correct);
    if (correct) {
      setCorrectCount((n) => n + 1);
      if (item.streak + 1 >= MASTER_STREAK) toast("🏆 이 문제를 정복했어요!");
    }
    setRevealed(false);
    setQueue(queue!.slice(1));
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <PageHeader title="다시 풀기" back="/review/wrong" />
        <Card className="flex flex-col items-center gap-3 py-6 text-center">
          {pet && <Pet species={pet.profile.pet.species} stage={pet.stage.stage} mood="excited" size={120} />}
          {total > 0 ? (
            <>
              <p className="font-display text-2xl">오늘 오답 복습 끝!</p>
              <p className="text-ink-soft">
                {total}문제 중 {correctCount}문제를 맞혔어요. <b className="text-xp-deep">+{total * XP_REWARDS.wrongAnswerRetried} XP</b>
              </p>
            </>
          ) : (
            <Empty icon="✨">오늘 다시 풀 문제가 없어요.</Empty>
          )}
          <Link href="/review/wrong" className={buttonStyles("primary", "md")}>
            오답노트로
          </Link>
        </Card>
      </div>
    );
  }

  const reason = WRONG_REASONS[item.reason];
  return (
    <div className="space-y-4">
      <PageHeader title="다시 풀기" back="/review/wrong" action={<span className="font-display text-sm text-ink-soft">남은 문제 {queue.length}</span>} />
      <ProgressBar value={(total - queue.length) / total} color="var(--accent)" label="진행률" />
      <Card className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <SubjectChip subject={item.subjectId ? subjectMap.get(item.subjectId) : undefined} />
          {item.unitId}
          <span className="ml-auto">연속 정답 {item.streak}/{MASTER_STREAK}</span>
        </div>
        {item.imageId && <StoredImage id={item.imageId} alt="문제 사진" className="max-h-96 w-full rounded-2xl object-contain" />}
        {item.question && <Markdown breaks className="text-lg">{item.question}</Markdown>}
      </Card>

      {revealed ? (
        <>
          <Card className="space-y-2">
            <div>
              <span className="text-sm text-ink-soft">정답 </span>
              <Markdown className="font-display inline-block align-top text-xl font-bold text-success-deep">{item.correctAnswer}</Markdown>
            </div>
            <div className="text-sm">
              <span className="text-ink-soft">지난번 내 답 </span>
              <Markdown className="inline-block align-top text-danger line-through">{item.myAnswer || "-"}</Markdown>
            </div>
            <p className="text-sm">
              {reason.icon} {reason.label}
              {item.note && <span className="text-ink-soft"> · {item.note}</span>}
            </p>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="lg" onClick={() => answer(false)}>
              ❌ 또 틀렸어요
            </Button>
            <Button variant="success" size="lg" onClick={() => answer(true)}>
              ⭕ 맞혔어요
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-center text-sm text-ink-soft">종이에 직접 풀어본 다음 정답을 확인하세요.</p>
          <Button size="lg" className="w-full" onClick={() => setRevealed(true)}>
            정답 확인
          </Button>
        </>
      )}
    </div>
  );
}
