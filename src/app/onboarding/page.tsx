"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Pet } from "@/components/Pet";
import { Button, Card, cn } from "@/components/ui";
import { GRADES, type GradeId } from "@/data/curriculum";
import { completeOnboarding } from "@/lib/db/profile";
import { PET_SPECIES, type PetSpecies } from "@/lib/game/pet";
import { terms } from "@/lib/game/companion";
import { useUiStyle } from "@/components/ThemeSync";
import { useProfile } from "@/lib/hooks";

const inputClass =
  "w-full rounded-2xl border-2 border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent";

export default function OnboardingPage() {
  const router = useRouter();
  const profile = useProfile();
  const style = useUiStyle();
  const t = terms(style);
  const noir = style === "noir";
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState("");
  const [grade, setGrade] = useState<GradeId | null>(null);
  const [goal, setGoal] = useState("");
  const [species, setSpecies] = useState<PetSpecies>("sprout");
  const [petName, setPetName] = useState("");
  const [hatching, setHatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !hatching) router.replace("/");
  }, [profile, hatching, router]);

  const canNext = [nickname.trim() && grade, true, petName.trim()][step];

  async function finish() {
    if (!grade) return;
    setHatching(true);
    setError(null);
    try {
      await completeOnboarding({ nickname, grade, goal, petSpecies: species, petName });
      setTimeout(() => router.replace("/"), 1400);
    } catch (e) {
      setHatching(false);
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8">
      <div className="text-center">
        <p className="font-display text-3xl text-primary">홈스터디</p>
        <p className="text-sm text-ink-soft">{t.pet}와(과) 함께 성장하는 자기주도 학습</p>
      </div>

      <ol className="flex justify-center gap-2" aria-label="진행 단계">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            aria-current={i === step ? "step" : undefined}
            className={cn("h-2.5 w-10 rounded-full", i <= step ? "bg-primary" : "bg-line")}
          />
        ))}
      </ol>

      {step === 0 && (
        <Card className="space-y-4">
          <h1 className="font-display text-xl">반가워요! 먼저 알려주세요</h1>
          <label className="block space-y-1.5">
            <span className="text-sm text-ink-soft">닉네임</span>
            <input className={inputClass} value={nickname} maxLength={12} onChange={(e) => setNickname(e.target.value)} placeholder="예: 공부왕" />
          </label>
          <fieldset className="space-y-1.5">
            <legend className="text-sm text-ink-soft">학년</legend>
            <div className="grid grid-cols-3 gap-2">
              {GRADES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={grade === g.id}
                  onClick={() => setGrade(g.id)}
                  className={cn(
                    "font-display rounded-2xl border-2 py-2.5 text-sm",
                    grade === g.id ? "border-primary bg-bg-soft text-primary-deep" : "border-line bg-surface",
                  )}
                >
                  {g.label.replace("중학교 ", "중").replace("고등학교 ", "고").replace("학년", "")}
                </button>
              ))}
            </div>
          </fieldset>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4">
          <h1 className="font-display text-xl">이루고 싶은 목표가 있나요?</h1>
          <p className="text-sm text-ink-soft">목표를 적어두면 홈 화면에서 매일 볼 수 있어요. 나중에 써도 돼요.</p>
          <input className={inputClass} value={goal} maxLength={40} onChange={(e) => setGoal(e.target.value)} placeholder="예: 2학기 기말 수학 90점" />
          <div className="flex flex-wrap gap-2">
            {["내신 성적 올리기", "매일 2시간 공부", "수능 대비 기초 다지기"].map((g) => (
              <button key={g} type="button" onClick={() => setGoal(g)} className="rounded-full border-2 border-line bg-surface-2 px-3 py-1 text-sm">
                {g}
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-4">
          <h1 className="font-display text-xl">{noir ? "함께할 동료를 고르세요" : "함께할 펫 알을 골라주세요"}</h1>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PET_SPECIES) as PetSpecies[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={species === s}
                onClick={() => setSpecies(s)}
                className={cn(
                  "flex flex-col items-center rounded-2xl border-2 p-2",
                  species === s ? "border-primary bg-bg-soft" : "border-line bg-surface",
                )}
              >
                <Pet species={s} stage="baby" mood="happy" size={72} />
                <span className="font-display text-sm">{t.speciesLabel(s)}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-ink-soft">{t.speciesDescription(species)}</p>
          <label className="block space-y-1.5">
            <span className="text-sm text-ink-soft">{t.pet} 이름</span>
            <input className={inputClass} value={petName} maxLength={10} onChange={(e) => setPetName(e.target.value)} placeholder="예: 쑥쑥이" />
          </label>
        </Card>
      )}

      {hatching && (
        <div className="flex flex-col items-center gap-2" aria-live="polite">
          <Pet species={species} stage="egg" mood="excited" size={120} />
          <p className="font-display">{noir ? `${petName}와(과) 계약했다. 공부하면 봉인이 풀린다.` : `${petName}의 알을 받았어요! 공부하면 알이 부화해요.`}</p>
        </div>
      )}
      {error && <p className="text-center text-danger">{error}</p>}

      <div className="mt-auto flex gap-3">
        {step > 0 && (
          <Button variant="ghost" className="flex-1" onClick={() => setStep(step - 1)} disabled={hatching}>
            이전
          </Button>
        )}
        {step < 2 ? (
          <Button className="flex-[2]" disabled={!canNext} onClick={() => setStep(step + 1)}>
            다음
          </Button>
        ) : (
          <Button variant="success" className="flex-[2]" disabled={!canNext || hatching} onClick={finish}>
            시작하기
          </Button>
        )}
      </div>
    </main>
  );
}
