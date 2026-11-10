"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/kit";
import { Pet } from "@/components/Pet";
import { useUiStyle } from "@/components/ThemeSync";
import { Button, Card, cn } from "@/components/ui";
import { isUnlocked, renderStory, storyFor, storyKey, type StoryEntry } from "@/data/story";
import { getDB } from "@/lib/db";
import { markRecordRead } from "@/lib/db/game";
import { badgeById } from "@/lib/game/achievements";
import { usePetState } from "@/lib/hooks";

export default function RecordsPage() {
  const style = useUiStyle();
  const noir = style === "noir";
  const state = usePetState();
  const badges = useLiveQuery(async () => new Set((await getDB().userBadges.toArray()).map((b) => b.badgeId)), []);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!state || !badges) return null;

  const { profile, level, stage } = state;
  const entries = storyFor(style);
  const read = new Set(profile.readRecords ?? []);
  const unlocked = entries.filter((e) => isUnlocked(e, level.level, badges));
  const open = entries.find((e) => e.id === openId);

  if (open) {
    const index = unlocked.findIndex((e) => e.id === open.id);
    return (
      <Reader
        key={open.id}
        entry={open}
        paragraphs={renderStory(open, profile.pet.name, profile.pet.species)}
        noir={noir}
        onBack={() => setOpenId(null)}
        prev={unlocked[index - 1]}
        next={unlocked[index + 1]}
        onGo={setOpenId}
      />
    );
  }

  const main = entries.filter((e) => "level" in e.unlock);
  const side = entries.filter((e) => "badge" in e.unlock);

  return (
    <div className="space-y-5">
      <PageHeader title={noir ? "동료의 기록" : "📔 펫의 일기"} back="/" />
      <Card className="flex items-center gap-3">
        <Pet species={profile.pet.species} stage={stage.stage} mood="happy" size={72} accessory={profile.equipped?.accessory} />
        <div className="min-w-0 flex-1">
          <p className="kicker">Archive</p>
          <p className="font-display text-lg">
            {unlocked.length} / {entries.length}
          </p>
          <p className="text-sm text-ink-soft">{noir ? `${profile.pet.name}의 봉인이 풀릴 때마다 기록이 하나씩 돌아온다.` : `레벨이 오를 때마다 ${profile.pet.name}의 일기가 한 장씩 열려요.`}</p>
        </div>
      </Card>

      <List title={noir ? "본편" : "일기"} entries={main} level={level.level} badges={badges} read={read} noir={noir} onOpen={setOpenId} />
      <List title={noir ? "외전" : "특별 일기"} entries={side} level={level.level} badges={badges} read={read} noir={noir} onOpen={setOpenId} />
    </div>
  );
}

function List({ title, entries, level, badges, read, noir, onOpen }: { title: string; entries: StoryEntry[]; level: number; badges: Set<string>; read: Set<string>; noir: boolean; onOpen: (id: string) => void }) {
  return (
    <section>
      <h2 className="font-display mb-2 text-lg">{title}</h2>
      <ul className="space-y-2">
        {entries.map((e) => {
          const ok = isUnlocked(e, level, badges);
          const isNew = ok && !read.has(storyKey(e.id));
          const condition = "level" in e.unlock ? `${noir ? "RANK" : "Lv."} ${e.unlock.level}에서 열림` : `업적 「${noir ? badgeById(e.unlock.badge)?.noirName : badgeById(e.unlock.badge)?.name}」 달성 시 열림`;
          return (
            <li key={e.id}>
              <button
                type="button"
                disabled={!ok}
                onClick={() => onOpen(e.id)}
                className={cn("card relative flex w-full items-center gap-3 rounded-3xl border-2 bg-surface p-3 text-left", isNew ? "border-accent" : "border-line", !ok && "opacity-55")}
              >
                <span className="font-mono w-16 shrink-0 text-[11px] tracking-wider text-ink-soft">{e.no}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-display block truncate">{ok ? e.title : noir ? "■■■■■■" : "아직 비밀이에요"}</span>
                  {!ok && <span className="block text-xs text-ink-soft">{condition}</span>}
                </span>
                {isNew && <span className="font-display shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] text-white">NEW</span>}
                <span aria-hidden className="text-ink-soft">
                  {ok ? "›" : "🔒"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Reader({ entry, paragraphs, noir, onBack, prev, next, onGo }: { entry: StoryEntry; paragraphs: string[]; noir: boolean; onBack: () => void; prev?: StoryEntry; next?: StoryEntry; onGo: (id: string) => void }) {
  // 읽기 시작하면 읽음으로 표시
  useEffect(() => {
    void markRecordRead(storyKey(entry.id));
    window.scrollTo({ top: 0 });
  }, [entry.id]);

  return (
    <article className="space-y-5">
      <button type="button" onClick={onBack} className="text-sm text-ink-soft underline">
        ‹ 목록으로
      </button>
      <header className={cn("space-y-1", noir ? "border-l-2 border-accent pl-4" : "text-center")}>
        <p className="font-mono text-xs tracking-[0.25em] text-ink-soft">{entry.no}</p>
        <h1 className="font-display text-3xl">{entry.title}</h1>
      </header>
      <div className={cn("space-y-4 leading-loose", noir ? "story-noir text-[17px]" : "text-base")}>
        {paragraphs.map((p, i) => (
          <p key={i} className="story-line" style={{ animationDelay: `${i * 0.25}s` }}>
            {p}
          </p>
        ))}
      </div>
      {noir && <div aria-hidden className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-accent to-transparent" />}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" disabled={!prev} onClick={() => prev && onGo(prev.id)}>
          ‹ 이전 기록
        </Button>
        {next ? (
          <Button variant="accent" onClick={() => onGo(next.id)}>
            다음 기록 ›
          </Button>
        ) : (
          <Button variant="ghost" onClick={onBack}>
            목록으로
          </Button>
        )}
      </div>
      {!next && <p className="text-center text-sm text-ink-soft">{noir ? "다음 기록은 아직 봉인되어 있다. 공부가 쌓이면 열린다." : "다음 일기는 레벨이 오르면 열려요!"}</p>}
    </article>
  );
}
