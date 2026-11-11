import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui";

export const metadata: Metadata = {
  title: "홈스터디 소개",
  description: "중·고등학생이 스스로 계획하고, 복습하고, 꾸준히 하도록 돕는 학습 앱",
};

const FEATURES = [
  { icon: "🗓️", title: "시험 D-day 역산 계획", text: "시험일과 범위, 하루 공부 시간만 정하면 남은 날에 맞춰 할 일을 자동으로 나눠 줘요. 밀리면 남은 단원으로 다시 짜요." },
  { icon: "🧠", title: "잊기 전에 복습", text: "카드와 오답노트를 간격 복습으로 다시 보여 주고, 단원별 기억 지도로 잊어 가는 곳을 한눈에 보여 줘요." },
  { icon: "🤖", title: "AI 학습실", text: "튜터가 힌트부터 차근차근 알려 주고, 자료 정리와 문제 만들기, 풀이 피드백까지 해 줘요. 하루 사용량도 정해 둬요." },
  { icon: "⏱️", title: "집중 타이머", text: "뽀모도로와 자유 측정. 집중한 시간은 할 일의 '실제 시간'으로 쌓여 계획과 비교할 수 있어요." },
  { icon: "🌱", title: "함께 자라는 동료", text: "공부할수록 동료가 자라고 이야기가 열려요. 하루 쉬어도 보호권이 연속 기록을 지켜 주고, 오래 쉬었다 와도 가볍게 다시 시작해요." },
  { icon: "📊", title: "성장 리포트", text: "주간·월간 리포트와 시험 점수 변화, 한 장의 이미지로 저장하는 기능까지. 잘한 점과 바꿀 점을 스스로 돌아봐요." },
];

const FACTS = [
  ["설치형 웹앱(PWA)", "휴대폰 홈 화면에 설치하고 오프라인에서도 열어요"],
  ["내 기기에 저장", "학습 기록은 기기 안(IndexedDB)에 두고 백업·복원을 지원해요"],
  ["AI 회사 선택", "Gemini · Claude · OpenAI 중 하나를 설정으로 골라요"],
  ["테스트", "단위 테스트와 휴대폰 화면 브라우저 테스트로 흐름을 계속 확인해요"],
];

export default function IntroPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-10 px-4 pb-16 pt-12">
      <header className="space-y-3 text-center">
        <p className="font-display text-lg text-primary-deep">홈스터디</p>
        <h1 className="font-display text-3xl leading-snug">스스로 계획하고, 복습하고,
          <br />
          꾸준히 하게 돕는 학습 앱</h1>
        <p className="text-ink-soft">중·고등학생이 혼자서도 공부 흐름을 만들 수 있도록 계획 · 복습 · AI · 습관을 한곳에 모았어요.</p>
        <Link href="/login" className={buttonStyles("primary", "lg", "mt-2")}>
          앱 열기
        </Link>
      </header>

      <section aria-label="주요 기능" className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <article key={f.title} className="rounded-3xl border-2 border-line bg-surface p-4">
            <p aria-hidden className="text-3xl">
              {f.icon}
            </p>
            <h2 className="font-display mt-1 text-lg">{f.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{f.text}</p>
          </article>
        ))}
      </section>

      <section aria-label="만든 방식">
        <h2 className="font-display mb-3 text-xl">이렇게 만들었어요</h2>
        <dl className="divide-y-2 divide-line rounded-3xl border-2 border-line bg-surface">
          {FACTS.map(([k, v]) => (
            <div key={k} className="p-4">
              <dt className="font-display">{k}</dt>
              <dd className="text-sm text-ink-soft">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-soft">Next.js · React · TypeScript · Tailwind · Dexie · Vercel AI SDK</p>
      </section>
    </main>
  );
}
