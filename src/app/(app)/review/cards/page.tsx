"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Empty, Field, PageHeader, Sheet, SubjectChip, SubjectPicker, TextInput, useSubjectMap, useSubjects } from "@/components/kit";
import { Button, Card, buttonStyles } from "@/components/ui";
import { getDB } from "@/lib/db";
import { addDeck } from "@/lib/db/study";
import { useMinuteTick } from "@/lib/timerStore";

export default function DecksPage() {
  const subjects = useSubjects() ?? [];
  const subjectMap = useSubjectMap();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState<string>();
  const tick = useMinuteTick();
  const decks = useLiveQuery(async () => {
    const db = getDB();
    const [decks, cards] = await Promise.all([db.decks.toArray(), db.cards.toArray()]);
    const now = Date.now();
    return decks
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((d) => {
        const mine = cards.filter((c) => c.deckId === d.id);
        return { ...d, total: mine.length, due: mine.filter((c) => c.due <= now).length };
      });
  }, [tick]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await addDeck(name, subjectId);
    setName("");
    setAdding(false);
  }

  const totalDue = decks?.reduce((s, d) => s + d.due, 0) ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="카드 묶음"
        back="/review"
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            + 새 묶음
          </Button>
        }
      />
      {totalDue > 0 && (
        <Link href="/review/cards/study" className={buttonStyles("primary", "lg", "w-full")}>
          모든 묶음 복습하기 ({totalDue}장)
        </Link>
      )}
      {decks && decks.length === 0 && (
        <Card>
          <Empty icon="🗂️">
            아직 카드 묶음이 없어요.
            <br />
            영단어, 역사 연도, 과학 용어처럼 외울 것을 묶어서 만들어 보세요.
          </Empty>
        </Card>
      )}
      <ul className="space-y-2">
        {decks?.map((d) => (
          <li key={d.id}>
            <Link href={`/review/cards/deck?id=${d.id}`}>
              <Card className="flex items-center gap-3">
                <span aria-hidden className="text-2xl">
                  🗂️
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display truncate">{d.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft">
                    <SubjectChip subject={d.subjectId ? subjectMap.get(d.subjectId) : undefined} />
                    카드 {d.total}장
                  </div>
                </div>
                {d.due > 0 && <span className="font-display rounded-full bg-primary px-2.5 py-0.5 text-sm text-white">{d.due}</span>}
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <Sheet open={adding} onClose={() => setAdding(false)} title="새 카드 묶음">
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="이름">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 영어 3과 단어" maxLength={30} autoFocus />
          </Field>
          <div>
            <p className="mb-1.5 text-sm text-ink-soft">과목</p>
            <SubjectPicker subjects={subjects} value={subjectId} onChange={setSubjectId} allowNone />
          </div>
          <Button type="submit" className="w-full" disabled={!name.trim()}>
            만들기
          </Button>
        </form>
      </Sheet>
    </div>
  );
}
