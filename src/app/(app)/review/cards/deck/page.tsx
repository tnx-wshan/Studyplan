"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Empty, Field, PageHeader, Sheet, TextArea, TextInput } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { Button, Card, buttonStyles } from "@/components/ui";
import { getDB } from "@/lib/db";
import { addCard, deleteCard, dueCards, deleteDeck, renameDeck, updateCard } from "@/lib/db/study";
import type { Card as CardT } from "@/lib/db/types";
import { parseBulk } from "@/lib/study/bulk";
import { useMinuteTick } from "@/lib/timerStore";
import { askConfirm, askText } from "@/components/Dialogs";

export default function DeckPage() {
  return (
    <Suspense fallback={null}>
      <Deck />
    </Suspense>
  );
}

function Deck() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const deck = useLiveQuery(async () => (await getDB().decks.get(id)) ?? null, [id]);
  const tick = useMinuteTick();
  // 지금 복습할 카드인지는 조회할 때의 시각으로 판단한다 (카드를 추가하면 바로 반영)
  const cards = useLiveQuery(async () => {
    const dueIds = new Set((await dueCards(id)).map((c) => c.id));
    return (await getDB().cards.where("deckId").equals(id).toArray()).map((c) => ({ ...c, isDue: dueIds.has(c.id) }));
  }, [id, tick]);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [editing, setEditing] = useState<CardT | null>(null);
  const [bulk, setBulk] = useState(false);

  if (deck === undefined || !cards) return null;
  if (deck === null) return <Empty icon="🔍">카드 묶음을 찾을 수 없어요.</Empty>;

  const due = cards.filter((c) => c.isDue).length;

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    await addCard(id, front, back);
    setFront("");
    setBack("");
    document.getElementById("card-front")?.focus();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={deck.name}
        back="/review/cards"
        action={
          <button
            type="button"
            className="text-sm text-ink-soft underline"
            onClick={async () => {
              const name = await askText("묶음 이름", { value: deck.name });
              if (name?.trim()) void renameDeck(id, name);
            }}
          >
            이름 변경
          </button>
        }
      />

      {due > 0 && (
        <Link href={`/review/cards/study?deck=${id}`} className={buttonStyles("primary", "lg", "w-full")}>
          복습하기 ({due}장)
        </Link>
      )}

      <Card>
        <form onSubmit={onAdd} className="space-y-2">
          <Field label="앞면 (질문)">
            <TextInput id="card-front" value={front} onChange={(e) => setFront(e.target.value)} placeholder="예: abundant" maxLength={200} />
          </Field>
          <Field label="뒷면 (정답)">
            <TextInput value={back} onChange={(e) => setBack(e.target.value)} placeholder="예: 풍부한" maxLength={500} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={!front.trim() || !back.trim()}>
              + 카드 추가
            </Button>
            <Button type="button" variant="ghost" onClick={() => setBulk(true)}>
              여러 장 한 번에
            </Button>
          </div>
        </form>
      </Card>

      <p className="font-display text-sm text-ink-soft">카드 {cards.length}장</p>
      {cards.length === 0 ? (
        <Card>
          <Empty icon="🃏">첫 카드를 만들어 보세요.</Empty>
        </Card>
      ) : (
        <ul className="space-y-2">
          {[...cards].reverse().map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setEditing(c)} className="w-full text-left">
                <Card className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate">{c.front}</p>
                    <p className="truncate text-sm text-ink-soft">{c.back}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-soft">{c.isDue ? "복습할 때" : c.srs.interval ? `${c.srs.interval}일 간격` : "배우는 중"}</span>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="ghost"
        className="w-full text-danger"
        onClick={async () => {
          if (!(await askConfirm(`"${deck.name}" 묶음과 카드 ${cards.length}장을 모두 지울까요?`, { danger: true, confirmLabel: "지우기" }))) return;
          await deleteDeck(id);
          router.replace("/review/cards");
        }}
      >
        묶음 삭제
      </Button>

      <EditSheet card={editing} onClose={() => setEditing(null)} />
      <BulkSheet open={bulk} onClose={() => setBulk(false)} deckId={id} />
    </div>
  );
}

function EditSheet({ card, onClose }: { card: CardT | null; onClose: () => void }) {
  return (
    <Sheet open={!!card} onClose={onClose} title="카드 고치기">
      {card && <EditForm key={card.id} card={card} onClose={onClose} />}
    </Sheet>
  );
}

function EditForm({ card, onClose }: { card: CardT; onClose: () => void }) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await updateCard(card.id, front, back);
        onClose();
      }}
    >
      <Field label="앞면">
        <TextInput value={front} onChange={(e) => setFront(e.target.value)} maxLength={200} />
      </Field>
      <Field label="뒷면">
        <TextInput value={back} onChange={(e) => setBack(e.target.value)} maxLength={500} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={!front.trim() || !back.trim()}>
          저장
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-danger"
          onClick={async () => {
            await deleteCard(card.id);
            onClose();
          }}
        >
          삭제
        </Button>
      </div>
    </form>
  );
}

function BulkSheet({ open, onClose, deckId }: { open: boolean; onClose: () => void; deckId: string }) {
  const [text, setText] = useState("");
  const parsed = parseBulk(text);
  return (
    <Sheet open={open} onClose={onClose} title="여러 장 한 번에 추가">
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">
          한 줄에 한 장씩 <b>앞면 - 뒷면</b> 형식으로 적어주세요. ( - , : , = , 탭으로 나눌 수 있어요)
        </p>
        <TextArea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"abundant - 풍부한\nreluctant - 꺼리는\n임진왜란 : 1592년"} />
        <Button
          className="w-full"
          disabled={parsed.length === 0}
          onClick={async () => {
            for (const c of parsed) await addCard(deckId, c.front, c.back);
            toast(`카드 ${parsed.length}장을 추가했어요`);
            setText("");
            onClose();
          }}
        >
          {parsed.length}장 추가하기
        </Button>
      </div>
    </Sheet>
  );
}
