"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useAiStatus } from "@/components/ai/useAiStatus";
import { PageHeader, SubjectPicker, useSubjects } from "@/components/kit";
import { Markdown } from "@/components/Markdown";
import { StoredImage } from "@/components/StoredImage";
import { Button, Card, cn } from "@/components/ui";
import { gradeLabel } from "@/data/curriculum";
import { blobToDataUrl, streamTutor } from "@/lib/ai/client";
import { getDB } from "@/lib/db";
import { addAssistantMessage, addUserMessage, createChat, deleteChat, updateChat } from "@/lib/db/ai";
import type { TutorChat, TutorMessage } from "@/lib/db/types";
import { useProfile } from "@/lib/hooks";
import { compressImage } from "@/lib/image";
import { askConfirm } from "@/components/Dialogs";

const MAX_IMAGES = 3;
const EXAMPLES = ["x² - 5x + 6 = 0 을 어떻게 풀어요?", "광합성과 호흡의 차이가 뭐예요?", "현재완료 시제는 언제 써요?"];

export default function TutorPage() {
  return (
    <Suspense fallback={null}>
      <Tutor />
    </Suspense>
  );
}

function ModeToggle({ mode, onChange }: { mode: TutorChat["mode"]; onChange: (m: TutorChat["mode"]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-label="답변 방식">
      {(
        [
          ["hint", "💡 힌트 모드", "스스로 풀도록 힌트만"],
          ["solution", "📖 풀이 모드", "단계별 풀이 보기"],
        ] as const
      ).map(([id, label, desc]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          onClick={() => onChange(id)}
          className={cn("rounded-xl px-2 py-1.5 text-left", mode === id ? "bg-surface shadow-[var(--shadow)]" : "text-ink-soft")}
        >
          <span className="font-display block text-sm">{label}</span>
          <span className="block text-[11px] text-ink-soft">{desc}</span>
        </button>
      ))}
    </div>
  );
}

function Tutor() {
  const params = useSearchParams();
  const router = useRouter();
  const chatId = params.get("id");
  const profile = useProfile();
  const subjects = useSubjects() ?? [];
  const { remaining, refresh, status } = useAiStatus();
  const chat = useLiveQuery(async () => (chatId ? ((await getDB().tutorChats.get(chatId)) ?? null) : null), [chatId]);
  const messages = useLiveQuery(async () => (chatId ? getDB().tutorMessages.where("chatId").equals(chatId).sortBy("createdAt") : []), [chatId]);

  // 새 대화일 때 고른 값
  const [draftMode, setDraftMode] = useState<TutorChat["mode"]>("hint");
  const [draftSubject, setDraftSubject] = useState<string>();
  const mode = chat?.mode ?? draftMode;
  const subjectId = chat ? chat.subjectId : draftSubject;

  const [text, setText] = useState("");
  const [images, setImages] = useState<Blob[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const partialRef = useRef("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const previews = useMemo(() => images.map((b) => URL.createObjectURL(b)), [images]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length, streaming]);

  const busy = streaming !== null;
  const left = remaining("tutor");

  async function buildRequestMessages(history: TutorMessage[]) {
    const db = getDB();
    const recent = history.filter((m) => !m.error).slice(-20);
    return Promise.all(
      recent.map(async (m, i) => {
        const withImages = m.role === "user" && m.imageIds?.length && i >= recent.length - 6;
        const imgs = withImages ? await Promise.all(m.imageIds!.map(async (id) => (await db.images.get(id))?.blob)) : [];
        const dataUrls = await Promise.all(imgs.filter((b): b is Blob => !!b).map(blobToDataUrl));
        return { role: m.role, content: m.content, ...(dataUrls.length ? { images: dataUrls } : {}) };
      }),
    );
  }

  async function ask(targetChatId: string) {
    const history = await getDB().tutorMessages.where("chatId").equals(targetChatId).sortBy("createdAt");
    const chatNow = await getDB().tutorChats.get(targetChatId);
    const subject = subjects.find((s) => s.id === chatNow?.subjectId);
    setError(null);
    setStreaming("");
    partialRef.current = "";
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reply = await streamTutor(
        {
          mode: chatNow?.mode ?? mode,
          grade: profile ? gradeLabel(profile.grade) : "중·고등학생",
          subject: subject?.name,
          messages: await buildRequestMessages(history),
        },
        (full) => {
          partialRef.current = full;
          setStreaming(full);
        },
        controller.signal,
      );
      await addAssistantMessage(targetChatId, reply);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        if (partialRef.current) await addAssistantMessage(targetChatId, partialRef.current + "\n\n(답변을 멈췄어요)");
      } else {
        setError(e instanceof Error ? e.message : "답을 받지 못했어요.");
      }
    } finally {
      setStreaming(null);
      abortRef.current = null;
      refresh();
    }
  }

  async function send(content = text) {
    if (busy || (!content.trim() && images.length === 0)) return;
    let id = chatId;
    if (!id) {
      const created = await createChat(draftMode, draftSubject);
      id = created.id;
      router.replace(`/ai/tutor?id=${id}`);
    }
    await addUserMessage(id, content, images);
    setText("");
    setImages([]);
    await ask(id);
  }

  const lastIsUser = messages && messages.length > 0 && messages[messages.length - 1].role === "user";

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-3">
      <PageHeader
        title={chat?.title ?? "AI 튜터"}
        back="/ai"
        action={
          chat && (
            <button
              type="button"
              className="text-sm text-ink-soft underline"
              onClick={async () => {
                if (!(await askConfirm("이 대화를 지울까요?", { danger: true, confirmLabel: "지우기" }))) return;
                await deleteChat(chat.id);
                router.replace("/ai");
              }}
            >
              삭제
            </button>
          )
        }
      />

      <ModeToggle mode={mode} onChange={(m) => (chat ? updateChat(chat.id, { mode: m }) : setDraftMode(m))} />
      {subjects.length > 0 && (
        <SubjectPicker subjects={subjects} value={subjectId} onChange={(id) => (chat ? updateChat(chat.id, { subjectId: id }) : setDraftSubject(id))} allowNone noneLabel="과목 없음" />
      )}

      <div className="flex-1 space-y-3" aria-live="polite">
        {messages?.length === 0 && !busy && (
          <Card className="space-y-3 text-center">
            <p className="text-4xl" aria-hidden>
              🧑‍🏫
            </p>
            <p className="text-sm text-ink-soft">
              {mode === "hint" ? "바로 정답을 알려주지 않고, 스스로 풀 수 있게 힌트를 줄게요." : "풀이를 단계별로 자세히 보여줄게요."}
              <br />
              문제 사진을 찍어서 물어봐도 돼요.
            </p>
            <div className="flex flex-col gap-1.5">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => send(ex)} className="rounded-2xl border-2 border-line px-3 py-2 text-sm" disabled={!status?.configured}>
                  {ex}
                </button>
              ))}
            </div>
          </Card>
        )}
        {messages?.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {busy && (
          <div className="mr-8 rounded-3xl rounded-tl-md border-2 border-line bg-surface p-3">
            {streaming ? <Markdown>{streaming}</Markdown> : <p className="animate-pulse text-sm text-ink-soft">생각하는 중…</p>}
          </div>
        )}
        {error && (
          <Card className="space-y-2 border-danger">
            <p className="text-sm text-danger">{error}</p>
            {lastIsUser && chatId && (
              <Button size="sm" variant="ghost" onClick={() => ask(chatId)}>
                다시 시도
              </Button>
            )}
          </Card>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-24 space-y-2 rounded-3xl border-2 border-line bg-surface p-2 shadow-[var(--shadow)]">
        {previews.length > 0 && (
          <div className="flex gap-2 px-1 pt-1">
            {previews.map((u, i) => (
              <div key={u} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- 첨부 미리보기 */}
                <img src={u} alt={`첨부 사진 ${i + 1}`} className="size-16 rounded-xl object-cover" />
                <button
                  type="button"
                  aria-label={`첨부 사진 ${i + 1} 빼기`}
                  onClick={() => setImages(images.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 size-6 rounded-full bg-ink text-xs text-bg"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <button
            type="button"
            aria-label="사진 첨부"
            disabled={images.length >= MAX_IMAGES || busy}
            onClick={() => fileRef.current?.click()}
            className="shrink-0 rounded-full p-2 text-2xl disabled:opacity-40"
          >
            📷
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])].slice(0, MAX_IMAGES - images.length);
              e.target.value = "";
              const compressed = await Promise.all(files.map((f) => compressImage(f, 1600)));
              setImages((xs) => [...xs, ...compressed].slice(0, MAX_IMAGES));
            }}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={status && !status.configured ? "AI 키를 먼저 설정해 주세요" : "궁금한 것을 물어보세요"}
            aria-label="질문"
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 outline-none"
          />
          {busy ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}>
              멈추기
            </Button>
          ) : (
            <Button type="submit" size="sm" disabled={(!text.trim() && images.length === 0) || !status?.configured || left === 0}>
              보내기
            </Button>
          )}
        </form>
        <p className="px-2 text-[11px] text-ink-soft">
          {left === null ? "" : left > 0 ? `오늘 ${left}번 더 물어볼 수 있어요 · ` : "오늘 질문을 모두 썼어요 · "}AI 답변은 틀릴 수 있어요
        </p>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: TutorMessage }) {
  if (message.role === "user") {
    return (
      <div className="ml-10 space-y-2">
        {message.imageIds?.map((id) => (
          <StoredImage key={id} id={id} alt="질문 사진" className="ml-auto max-h-60 rounded-2xl object-contain" />
        ))}
        {message.content && <p className="ml-auto w-fit whitespace-pre-wrap rounded-3xl rounded-tr-md bg-primary px-4 py-2.5 text-white">{message.content}</p>}
      </div>
    );
  }
  return (
    <div className="mr-8 rounded-3xl rounded-tl-md border-2 border-line bg-surface p-3">
      <Markdown>{message.content}</Markdown>
    </div>
  );
}
