"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Empty, PageHeader, SubjectChip, TextArea, TextInput, useSubjectMap } from "@/components/kit";
import { Markdown } from "@/components/Markdown";
import { Pet } from "@/components/Pet";
import { toast } from "@/components/Toaster";
import { Button, Card, ProgressBar, buttonStyles, cn } from "@/components/ui";
import { getDB } from "@/lib/db";
import { deleteQuiz, finishQuiz, flagQuestion, recordAnswer, resetQuiz, saveQuestionToCards, saveQuestionToWrong } from "@/lib/db/ai";
import type { Question, Subject } from "@/lib/db/types";
import { usePetState } from "@/lib/hooks";
import { gradeAnswer } from "@/lib/study/grade";

const TYPE_LABELS = { multiple: "객관식", short: "단답형", essay: "서술형" } as const;

export default function QuizPage() {
  return (
    <Suspense fallback={null}>
      <QuizScreen />
    </Suspense>
  );
}

function QuizScreen() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const subjectMap = useSubjectMap();
  const quiz = useLiveQuery(async () => (await getDB().quizzes.get(id)) ?? null, [id]);
  const questions = useLiveQuery(() => getDB().questions.where("quizId").equals(id).sortBy("order"), [id]);
  const material = useLiveQuery(async () => (quiz?.materialIds[0] ? getDB().materials.get(quiz.materialIds[0]) : undefined), [quiz?.materialIds[0]]);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [showMaterial, setShowMaterial] = useState(false);

  if (quiz === undefined || !questions) return null;
  if (quiz === null) {
    return (
      <>
        <PageHeader title="퀴즈" back="/ai" />
        <Card>
          <Empty icon="🔍">퀴즈를 찾을 수 없어요.</Empty>
        </Card>
      </>
    );
  }

  const subject = quiz.subjectId ? subjectMap.get(quiz.subjectId) : undefined;
  const answered = questions.filter((q) => q.result).length;
  const current = feedbackId ? questions.find((q) => q.id === feedbackId) : questions.find((q) => !q.result);

  async function next() {
    const remaining = questions!.filter((q) => !q.result && q.id !== feedbackId).length;
    setFeedbackId(null);
    if (remaining === 0) await finishQuiz(quiz!.id);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={quiz.title}
        back="/ai"
        action={
          <button
            type="button"
            className="text-sm text-ink-soft underline"
            onClick={async () => {
              if (!confirm("이 퀴즈와 자료를 지울까요? 오답노트·카드에 저장한 문제는 남아요.")) return;
              await deleteQuiz(quiz.id);
              router.replace("/ai");
            }}
          >
            삭제
          </button>
        }
      />
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
        <SubjectChip subject={subject} />
        <span>{quiz.madeBy}가 만든 문제</span>
        {quiz.verified && <span className="rounded-full bg-success/15 px-2 py-0.5 text-success-deep">정답 검산 완료</span>}
      </div>

      {material && (
        <Card className="p-3">
          <button type="button" aria-expanded={showMaterial} onClick={() => setShowMaterial(!showMaterial)} className="font-display flex w-full items-center justify-between text-sm">
            📄 자료: {material.title}
            <span aria-hidden className="text-ink-soft">
              {showMaterial ? "▲" : "▼"}
            </span>
          </button>
          {showMaterial && (
            <div className="mt-3 space-y-2 text-sm">
              <Markdown>{material.summary}</Markdown>
              {material.sources.length > 0 && (
                <p className="text-xs">
                  출처:{" "}
                  {material.sources.map((s, i) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                      {s.title}
                      {i < material.sources.length - 1 ? ", " : ""}
                    </a>
                  ))}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {current ? (
        <>
          <div className="flex items-center gap-2">
            <ProgressBar value={answered / questions.length} color="var(--accent)" label="퀴즈 진행률" />
            <span className="font-display shrink-0 text-sm tabular-nums">
              {Math.min(answered + (feedbackId ? 0 : 1), questions.length)}/{questions.length}
            </span>
          </div>
          {feedbackId && current.result ? (
            <Feedback key={current.id} question={current} subject={subject} onNext={next} isLast={questions.filter((q) => !q.result).length === 0} />
          ) : (
            <Answer key={current.id} question={current} onAnswered={() => setFeedbackId(current.id)} />
          )}
        </>
      ) : (
        <Summary questions={questions} subject={subject} quizId={quiz.id} onRetry={() => setFeedbackId(null)} />
      )}
    </div>
  );
}

function Answer({ question, onAnswered }: { question: Question; onAnswered: () => void }) {
  const [text, setText] = useState("");
  const [revealed, setRevealed] = useState(false);

  async function submit(answer: string) {
    const g = gradeAnswer(question, answer);
    if (g === "self") return setRevealed(true);
    await recordAnswer(question.id, answer, g);
    onAnswered();
  }

  return (
    <Card className="space-y-4">
      <span className="font-display rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{TYPE_LABELS[question.type]}</span>
      <Markdown className="text-lg">{question.prompt}</Markdown>

      {question.type === "multiple" && (
        <ul className="space-y-2">
          {question.choices.map((c, i) => (
            <li key={c}>
              <button type="button" onClick={() => submit(c)} className="flex w-full items-start gap-3 rounded-2xl border-2 border-line bg-surface p-3 text-left hover:border-accent">
                <span className="font-display shrink-0 text-accent">{"①②③④⑤⑥"[i]}</span>
                <Markdown className="flex-1">{c}</Markdown>
              </button>
            </li>
          ))}
        </ul>
      )}

      {question.type === "short" && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void submit(text.trim());
          }}
        >
          <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="답을 쓰세요" aria-label="답" autoFocus maxLength={200} />
          <Button type="submit" disabled={!text.trim()}>
            제출
          </Button>
        </form>
      )}

      {question.type === "essay" &&
        (revealed ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-surface-2 p-3 text-sm">
              <p className="text-xs text-ink-soft">내 답</p>
              <p className="whitespace-pre-wrap">{text || "(쓰지 않음)"}</p>
            </div>
            <div className="rounded-2xl bg-success/10 p-3 text-sm">
              <p className="text-xs text-ink-soft">모범 답안</p>
              <Markdown>{question.answer}</Markdown>
            </div>
            <p className="text-center text-sm">모범 답안의 핵심이 내 답에 들어 있나요?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => recordAnswer(question.id, text, "wrong").then(onAnswered)}>
                ❌ 부족해요
              </Button>
              <Button variant="success" onClick={() => recordAnswer(question.id, text, "correct").then(onAnswered)}>
                ⭕ 잘 썼어요
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <TextArea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="생각을 정리해서 써 보세요" aria-label="서술형 답" maxLength={2000} />
            <Button className="w-full" onClick={() => submit(text)}>
              모범 답안과 비교하기
            </Button>
          </div>
        ))}
    </Card>
  );
}

function Feedback({ question, subject, onNext, isLast }: { question: Question; subject?: Subject; onNext: () => void; isLast: boolean }) {
  const correct = question.result === "correct";
  return (
    <div className="space-y-3">
      <Card className={cn("space-y-3", correct ? "border-success" : "border-danger")}>
        <p className={cn("font-display text-2xl", correct ? "text-success-deep" : "text-danger")}>{correct ? "⭕ 정답!" : "❌ 아쉬워요"}</p>
        <Markdown>{question.prompt}</Markdown>
        <div className="grid gap-2 text-sm">
          {question.type !== "essay" && (
            <div className="flex gap-1">
              <span className="shrink-0 text-ink-soft">내 답 </span>
              <Markdown className={correct ? "" : "text-danger line-through"}>{question.userAnswer ?? ""}</Markdown>
            </div>
          )}
          <div className="flex gap-1">
            <span className="shrink-0 text-ink-soft">정답 </span>
            <Markdown className="font-display text-success-deep">{question.answer}</Markdown>
          </div>
        </div>
        <div className="rounded-2xl bg-surface-2 p-3 text-sm">
          <p className="font-display mb-1">💡 해설</p>
          <Markdown>{question.explanation}</Markdown>
          {question.concept && <p className="mt-2 text-xs text-ink-soft">핵심 개념: {question.concept}</p>}
        </div>
        {!correct && question.type === "short" && (
          <button type="button" className="text-xs text-ink-soft underline" onClick={() => recordAnswer(question.id, question.userAnswer ?? "", "correct")}>
            표현만 다르고 맞게 썼어요 → 정답으로 처리
          </button>
        )}
      </Card>
      <QuestionActions question={question} subject={subject} />
      <Button size="lg" className="w-full" onClick={onNext}>
        {isLast ? "결과 보기" : "다음 문제 →"}
      </Button>
    </div>
  );
}

function QuestionActions({ question, subject }: { question: Question; subject?: Subject }) {
  return (
    <div className="flex flex-wrap gap-2">
      {question.result === "wrong" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={question.savedToWrong}
          onClick={async () => (await saveQuestionToWrong(question, subject?.id)) && toast("오답노트에 저장했어요")}
        >
          {question.savedToWrong ? "✓ 오답노트에 있음" : "📝 오답노트에"}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={question.savedToCard}
        onClick={async () => (await saveQuestionToCards(question, subject?.id, subject?.name)) && toast("복습 카드로 만들었어요")}
      >
        {question.savedToCard ? "✓ 카드에 있음" : "🃏 카드로"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className={question.flagged ? "text-danger" : undefined}
        onClick={async () => {
          await flagQuestion(question.id, !question.flagged);
          toast(question.flagged ? "표시를 지웠어요" : "이상한 문제로 표시했어요. 교과서로 꼭 확인하세요!");
        }}
      >
        🚩 {question.flagged ? "표시됨" : "문제가 이상해요"}
      </Button>
    </div>
  );
}

function Summary({ questions, subject, quizId, onRetry }: { questions: Question[]; subject?: Subject; quizId: string; onRetry: () => void }) {
  const pet = usePetState();
  const [open, setOpen] = useState<string | null>(null);
  const score = questions.filter((q) => q.result === "correct").length;
  const wrong = questions.filter((q) => q.result === "wrong");
  const unsaved = wrong.filter((q) => !q.savedToWrong);
  const ratio = score / questions.length;

  return (
    <div className="space-y-4">
      <Card className="flex flex-col items-center gap-2 py-5 text-center">
        {pet && <Pet species={pet.profile.pet.species} stage={pet.stage.stage} mood={ratio >= 0.6 ? "excited" : "happy"} size={110} />}
        <p className="font-display text-4xl">
          {score} / {questions.length}
        </p>
        <p className="text-ink-soft">{ratio === 1 ? "완벽해요! 🎉" : ratio >= 0.6 ? "잘했어요! 틀린 문제만 다시 보면 돼요." : "괜찮아요. 해설을 읽고 다시 풀어 보세요."}</p>
      </Card>

      {unsaved.length > 0 && (
        <Button
          variant="accent"
          className="w-full"
          onClick={async () => {
            for (const q of unsaved) await saveQuestionToWrong(q, subject?.id);
            toast(`틀린 문제 ${unsaved.length}개를 오답노트에 저장했어요`);
          }}
        >
          📝 틀린 문제 {unsaved.length}개 오답노트에 저장
        </Button>
      )}

      <ul className="space-y-2">
        {questions.map((q, i) => (
          <li key={q.id}>
            <Card className="p-3">
              <button type="button" aria-expanded={open === q.id} onClick={() => setOpen(open === q.id ? null : q.id)} className="flex w-full items-start gap-2 text-left">
                <span aria-hidden>{q.result === "correct" ? "⭕" : "❌"}</span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="text-ink-soft">{i + 1}. </span>
                  <Markdown className={open === q.id ? "" : "line-clamp-1"}>{q.prompt}</Markdown>
                </span>
                {q.flagged && <span aria-label="이상한 문제로 표시됨">🚩</span>}
              </button>
              {open === q.id && (
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex gap-1">
                    <span className="shrink-0 text-ink-soft">정답</span>
                    <Markdown className="font-display text-success-deep">{q.answer}</Markdown>
                  </div>
                  <Markdown>{q.explanation}</Markdown>
                  <QuestionActions question={q} subject={subject} />
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="ghost"
          onClick={async () => {
            await resetQuiz(quizId);
            onRetry();
          }}
        >
          🔁 다시 풀기
        </Button>
        <Link href="/ai/create" className={buttonStyles("primary", "md")}>
          ✨ 새 문제 만들기
        </Link>
      </div>
    </div>
  );
}
