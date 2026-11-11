"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { AiStatusCard } from "@/components/ai/AiStatusCard";
import { useAiStatus } from "@/components/ai/useAiStatus";
import { Empty, PageHeader, SubjectChip, useSubjectMap } from "@/components/kit";
import { Card, SectionTitle, buttonStyles } from "@/components/ui";
import { getDB } from "@/lib/db";

function ago(ts: number) {
  const min = Math.round((Date.now() - ts) / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

export default function AiHubPage() {
  const { status, error } = useAiStatus();
  const subjectMap = useSubjectMap();
  const chats = useLiveQuery(() => getDB().tutorChats.orderBy("updatedAt").reverse().limit(5).toArray(), []);
  const quizzes = useLiveQuery(async () => {
    const db = getDB();
    const qs = (await db.quizzes.toArray()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
    return Promise.all(qs.map(async (q) => ({ ...q, count: await db.questions.where("quizId").equals(q.id).count() })));
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader title="🤖 AI 학습실" />
      <AiStatusCard status={status} error={error} />

      <div className="grid grid-cols-2 gap-3">
        <Link href="/ai/tutor" className={buttonStyles("primary", "lg", "flex-col gap-0 py-4")}>
          <span className="text-2xl">💬</span>
          튜터에게 질문
        </Link>
        <Link href="/ai/create" className={buttonStyles("accent", "lg", "flex-col gap-0 py-4")}>
          <span className="text-2xl">✨</span>
          문제 만들기
        </Link>
      </div>
      <Link href="/ai/library" className={buttonStyles("ghost", "md", "w-full")}>
        📚 모두의 자료실 <span className="text-xs text-ink-soft">AI 없이 다른 학생이 만든 자료로</span>
      </Link>
      <p className="text-center text-xs text-ink-soft">AI도 틀릴 수 있어요. 중요한 내용은 교과서로 한 번 더 확인하세요.</p>

      <section>
        <SectionTitle>최근 질문</SectionTitle>
        <Card className="p-2">
          {chats && chats.length > 0 ? (
            <ul>
              {chats.map((c) => (
                <li key={c.id}>
                  <Link href={`/ai/tutor?id=${c.id}`} className="flex items-center gap-2 rounded-2xl px-2 py-2.5 hover:bg-surface-2">
                    <span aria-hidden>{c.mode === "hint" ? "💡" : "📖"}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                    <SubjectChip subject={c.subjectId ? subjectMap.get(c.subjectId) : undefined} />
                    <span className="shrink-0 text-xs text-ink-soft">{ago(c.updatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="💬">모르는 문제를 사진으로 찍어 물어보세요.</Empty>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>내 퀴즈</SectionTitle>
        <Card className="p-2">
          {quizzes && quizzes.length > 0 ? (
            <ul>
              {quizzes.map((q) => {
                const last = q.attempts.at(-1);
                return (
                  <li key={q.id}>
                    <Link href={`/ai/quiz?id=${q.id}`} className="flex items-center gap-2 rounded-2xl px-2 py-2.5 hover:bg-surface-2">
                      <span aria-hidden>📝</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{q.title}</span>
                        <span className="text-xs text-ink-soft">
                          {q.count}문제 · {ago(q.createdAt)}
                        </span>
                      </span>
                      <SubjectChip subject={q.subjectId ? subjectMap.get(q.subjectId) : undefined} />
                      <span className="font-display shrink-0 text-sm">{last ? `${last.score}/${last.total}` : "새 퀴즈"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty icon="✨">교과서 사진, PDF, 검색 자료로 나만의 문제를 만들어 보세요.</Empty>
          )}
        </Card>
      </section>
    </div>
  );
}
