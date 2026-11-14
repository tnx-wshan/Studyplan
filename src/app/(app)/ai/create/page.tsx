"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiStatusCard } from "@/components/ai/AiStatusCard";
import { useAiStatus } from "@/components/ai/useAiStatus";
import { Field, PageHeader, Select, SubjectPicker, TextInput, useSubjects } from "@/components/kit";
import { Markdown } from "@/components/Markdown";
import { Pet } from "@/components/Pet";
import { Button, Card, SectionTitle, cn } from "@/components/ui";
import { courseById, gradeLabel } from "@/data/curriculum";
import { classificationLabel } from "@/data/classification";
import { gradeShort as gradeShortName } from "@/lib/learn/names";
import { blobToDataUrl, requestMaterial, requestQuiz, type MaterialResponse } from "@/lib/ai/client";
import type { MaterialRequest } from "@/lib/ai/schemas";
import { saveMaterialAndQuiz } from "@/lib/db/ai";
import type { Material, Quiz } from "@/lib/db/types";
import { usePetState, useProfile } from "@/lib/hooks";
import { compressImage } from "@/lib/image";

type Source = Material["kind"];
const SOURCES: { id: Source; icon: string; label: string; desc: string }[] = [
  { id: "photo", icon: "📷", label: "사진", desc: "교과서·필기·학습지" },
  { id: "pdf", icon: "📄", label: "PDF", desc: "프린트·자료 파일" },
  { id: "web", icon: "🔎", label: "웹 검색", desc: "주제로 자료 찾기" },
  { id: "curriculum", icon: "📚", label: "교과 단원", desc: "단원 개념 정리" },
];
const MAX_PHOTOS = 5;
const MAX_PDF_MB = 10;
const TYPE_LABELS = { multiple: "객관식", short: "단답형", essay: "서술형" } as const;
const DIFFICULTY_LABELS = { easy: "쉬움", normal: "보통", hard: "어려움" } as const;

export default function CreateQuizPage() {
  const router = useRouter();
  const profile = useProfile();
  const pet = usePetState();
  const subjects = useSubjects() ?? [];
  const { status, error: statusError, refresh, remaining } = useAiStatus();

  const [source, setSource] = useState<Source>("photo");
  const [subjectId, setSubjectId] = useState<string>();
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [pdf, setPdf] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [courseId, setCourseId] = useState("");
  const [unit, setUnit] = useState("");
  const [material, setMaterial] = useState<MaterialResponse | null>(null);
  const [showSummary, setShowSummary] = useState(true);

  const [count, setCount] = useState(5);
  const [types, setTypes] = useState<(keyof typeof TYPE_LABELS)[]>(["multiple", "short"]);
  const [difficulty, setDifficulty] = useState<Quiz["difficulty"]>("normal");
  const [verifyChoice, setVerifyChoice] = useState<boolean | null>(null);

  const [busy, setBusy] = useState<null | "material" | "quiz">(null);
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const subject = subjects.find((s) => s.id === subjectId);
  const grade = profile ? gradeLabel(profile.grade) : "중·고등학생";
  const courses = useMemo(() => (subject ? subject.courseIds.map(courseById).filter((c) => !!c) : []), [subject]);
  // 교육과정 과목이 하나뿐이면(대부분의 중학교 과목) 다시 고르지 않는다. 선택과목처럼 여럿이면 고른다
  const course = courses.length === 1 ? courses[0] : courseById(courseId);
  const unitOptions = useMemo(() => {
    if (!subject) return [];
    return [...new Set([...(course?.units ?? []), ...subject.customUnits])];
  }, [subject, course]);
  const courseName = course?.name ?? subject?.name ?? "";
  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  // 계산이 있는 과목은 정답 검산을 기본으로 켠다
  const verify = verifyChoice ?? (subject?.group === "math" || subject?.group === "science");

  const ready =
    (source === "photo" && photos.length > 0) ||
    (source === "pdf" && !!pdf) ||
    (source === "web" && query.trim().length > 0) ||
    (source === "curriculum" && !!subject && !!unit.trim() && (courses.length <= 1 || !!course));

  async function onMakeMaterial() {
    if (!ready) return;
    setBusy("material");
    setError(null);
    try {
      let body: MaterialRequest;
      const subjectGroup = subject?.group;
      if (source === "photo") body = { kind: "photo", grade, subject: subject?.name, subjectGroup, images: await Promise.all(photos.map(blobToDataUrl)) };
      else if (source === "pdf") body = { kind: "pdf", grade, subject: subject?.name, subjectGroup, pdf: await blobToDataUrl(pdf!) };
      else if (source === "web") body = { kind: "web", grade, subject: subject?.name, subjectGroup, query: query.trim() };
      else body = { kind: "curriculum", grade, subjectGroup, course: courseName, unit: unit.trim() };
      setMaterial(await requestMaterial(body));
      setShowSummary(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "자료를 정리하지 못했어요.");
    } finally {
      setBusy(null);
      refresh();
    }
  }

  async function onMakeQuiz() {
    if (!material) return;
    setBusy("quiz");
    setError(null);
    try {
      const text = `# ${material.title}\n\n${material.summary}\n\n## 핵심\n${material.keyPoints.map((k) => `- ${k}`).join("\n")}`;
      const quiz = await requestQuiz({ grade, subject: subject?.name, subjectGroup: subject?.group, bankMaterialId: material.bankId, material: text.slice(0, 30_000), count, types, difficulty, verify });
      const saved = await saveMaterialAndQuiz(
        {
          kind: source,
          title: material.title,
          summary: material.summary,
          keyPoints: material.keyPoints,
          sources: material.sources,
          subjectId,
          query: source === "web" ? query.trim() : source === "curriculum" ? unit.trim() : undefined,
        },
        { title: quiz.title, difficulty, verified: quiz.verified, madeBy: quiz.fromBank ? "모두의 자료실" : (status?.providerLabel ?? "AI"), questions: quiz.questions },
      );
      router.push(`/ai/quiz?id=${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "문제를 만들지 못했어요.");
      setBusy(null);
      refresh();
    }
  }

  if (busy) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
        {pet && <Pet species={pet.profile.pet.species} stage={pet.stage.stage} mood="excited" size={140} />}
        <p className="font-display text-xl">{busy === "material" ? (source === "web" ? "자료를 검색하고 정리하는 중…" : "자료를 읽고 정리하는 중…") : "문제를 만드는 중…"}</p>
        <p className="text-sm text-ink-soft">{busy === "quiz" && verify ? "정답이 맞는지 한 번 더 검산하고 있어요. " : ""}보통 10~30초쯤 걸려요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="✨ 문제 만들기" back="/ai" />
      {status && !status.configured && <AiStatusCard status={status} error={statusError} />}
      <Link href="/ai/library" className="block rounded-2xl border-2 border-dashed border-line p-3 text-sm">
        📚 <span className="font-display">모두의 자료실</span>
        <span className="block text-xs text-ink-soft">다른 학생들이 만든 정리와 문제를 AI 없이 바로 쓸 수 있어요.</span>
      </Link>

      <section>
        <SectionTitle>1. 어떤 자료로 만들까요?</SectionTitle>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="자료 종류">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={source === s.id}
              onClick={() => {
                setSource(s.id);
                setMaterial(null);
              }}
              className={cn("rounded-2xl border-2 p-3 text-left", source === s.id ? "border-accent bg-accent/10" : "border-line bg-surface")}
            >
              <span className="font-display block">
                {s.icon} {s.label}
              </span>
              <span className="text-xs text-ink-soft">{s.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <Card className="space-y-3">
        <div>
          <p className="mb-1.5 text-sm text-ink-soft">과목{source === "curriculum" ? "" : " (선택)"}</p>
          <SubjectPicker
            subjects={subjects}
            value={subjectId}
            onChange={(id) => {
              setSubjectId(id);
              setCourseId("");
              setUnit("");
            }}
            allowNone={source !== "curriculum"}
          />
        </div>

        {source === "photo" && (
          <div className="space-y-2">
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previews.map((u, i) => (
                  <div key={u} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 업로드 미리보기 */}
                    <img src={u} alt={`자료 사진 ${i + 1}`} className="size-20 rounded-xl object-cover" />
                    <button
                      type="button"
                      aria-label={`자료 사진 ${i + 1} 빼기`}
                      onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                      className="absolute -right-1.5 -top-1.5 size-6 rounded-full bg-ink text-xs text-bg"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="ghost" className="w-full" disabled={photos.length >= MAX_PHOTOS} onClick={() => photoRef.current?.click()}>
              📷 사진 추가 ({photos.length}/{MAX_PHOTOS})
            </Button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = [...(e.target.files ?? [])].slice(0, MAX_PHOTOS - photos.length);
                e.target.value = "";
                const compressed = await Promise.all(files.map((f) => compressImage(f, 1600)));
                setPhotos((xs) => [...xs, ...compressed].slice(0, MAX_PHOTOS));
                setMaterial(null);
              }}
            />
            <p className="text-xs text-ink-soft">글씨가 잘 보이게 밝은 곳에서 찍어 주세요.</p>
          </div>
        )}

        {source === "pdf" && (
          <div className="space-y-2">
            <Button type="button" variant="ghost" className="w-full" onClick={() => pdfRef.current?.click()}>
              📄 {pdf ? pdf.name : "PDF 고르기"}
            </Button>
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > MAX_PDF_MB * 1024 * 1024) return setError(`PDF는 ${MAX_PDF_MB}MB까지 올릴 수 있어요. 필요한 쪽만 나눠서 올려 주세요.`);
                setError(null);
                setPdf(f);
                setMaterial(null);
              }}
            />
            <p className="text-xs text-ink-soft">{MAX_PDF_MB}MB까지. 시험 범위 쪽만 담은 파일이 더 좋은 문제를 만들어요.</p>
          </div>
        )}

        {source === "web" && (
          <Field label="무엇을 공부할까요?" hint="AI가 웹에서 믿을 만한 자료를 찾아 정리하고 출처를 알려줘요.">
            <TextInput
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setMaterial(null);
              }}
              placeholder="예: 광합성과 호흡의 차이"
              maxLength={200}
            />
          </Field>
        )}

        {source === "curriculum" && subject && (
          <div className="grid gap-2">
            {courses.length > 1 && (
              <Field label="교육과정 과목 (선택과목)">
                <Select
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    setMaterial(null);
                  }}
                >
                  <option value="">선택하세요</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="교과서 단원" hint="교과서 목차의 단원 이름을 써 주세요. 출판사는 상관없어요. 대표 단원에서 골라도 돼요.">
              <TextInput
                value={unit}
                list="unit-suggestions"
                maxLength={120}
                placeholder={unitOptions[0] ? `예: ${unitOptions[0]}` : "예: Ⅰ. 소인수분해 - 1. 소수와 합성수"}
                onChange={(e) => {
                  setUnit(e.target.value);
                  setMaterial(null);
                }}
              />
              <datalist id="unit-suggestions">
                {unitOptions.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </Field>
            {unit.trim() && (
              <p className="rounded-2xl bg-surface-2 px-3 py-2 text-xs" aria-label="자료 분류">
                🏷️ {classificationLabel({ grade: profile ? gradeShortName(profile.grade) : "", subject: courseName, unit: unit.trim() })}
              </p>
            )}
          </div>
        )}

        {!material && (
          <Button className="w-full" disabled={!ready} onClick={onMakeMaterial}>
            자료 정리하기 {remaining("material") !== null && <span className="text-xs opacity-80">(오늘 {remaining("material")}회 남음)</span>}
          </Button>
        )}
      </Card>

      {error && (
        <Card role="alert" className="border-danger text-sm text-danger">
          {error}
        </Card>
      )}

      {material && (
        <>
          <section>
            <SectionTitle
              action={
                <button type="button" className="text-sm text-ink-soft underline" onClick={() => setShowSummary(!showSummary)}>
                  {showSummary ? "접기" : "펼치기"}
                </button>
              }
            >
              📄 {material.title}
            </SectionTitle>
            <Card className="space-y-3">
              {material.fromBank && <p className="rounded-2xl bg-accent/10 p-3 text-sm">📚 다른 학생이 먼저 정리한 자료를 모두의 자료실에서 가져왔어요. AI 사용 횟수는 쓰지 않았어요.</p>}
              {material.notice && <p className="rounded-2xl bg-xp/10 p-3 text-sm">⚠️ {material.notice}</p>}
              {showSummary && <Markdown>{material.summary}</Markdown>}
              {material.keyPoints.length > 0 && (
                <div className="rounded-2xl bg-xp/10 p-3">
                  <p className="font-display mb-1 text-sm">⭐ 핵심</p>
                  <ul className="space-y-1 text-sm">
                    {material.keyPoints.map((k) => (
                      <li key={k} className="flex gap-1.5">
                        <span aria-hidden>•</span>
                        <Markdown className="flex-1">{k}</Markdown>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {material.sources.length > 0 && (
                <div className="text-xs">
                  <p className="mb-1 text-ink-soft">출처</p>
                  <ul className="space-y-0.5">
                    {material.sources.map((s) => (
                      <li key={s.url}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-ink-soft">AI가 정리한 내용이라 틀린 부분이 있을 수 있어요.</p>
            </Card>
          </section>

          <section>
            <SectionTitle>2. 어떤 문제를 만들까요?</SectionTitle>
            <Card className="space-y-4">
              <ChipRow label="문제 수" options={[3, 5, 10, 15].map((n) => ({ id: n, label: `${n}문제` }))} value={count} onChange={setCount} />
              <div>
                <p className="mb-1.5 text-sm text-ink-soft">유형 (여러 개 고를 수 있어요)</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(TYPE_LABELS) as (keyof typeof TYPE_LABELS)[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={types.includes(t)}
                      onClick={() => setTypes(types.includes(t) ? (types.length > 1 ? types.filter((x) => x !== t) : types) : [...types, t])}
                      className={cn("font-display rounded-full border-2 px-3 py-1 text-sm", types.includes(t) ? "border-accent bg-accent text-white" : "border-line")}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <ChipRow label="난이도" options={(Object.keys(DIFFICULTY_LABELS) as Quiz["difficulty"][]).map((d) => ({ id: d, label: DIFFICULTY_LABELS[d] }))} value={difficulty} onChange={setDifficulty} />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-5 accent-[var(--accent)]" checked={verify} onChange={(e) => setVerifyChoice(e.target.checked)} />
                <span>
                  정답 검산하기
                  <span className="block text-xs text-ink-soft">AI가 문제를 한 번 더 풀어서 정답을 확인해요. 조금 더 오래 걸려요.</span>
                </span>
              </label>
              <Button size="lg" variant="accent" className="w-full" disabled={busy !== null} onClick={onMakeQuiz}>
                ✨ 문제 만들기 {remaining("quiz") !== null && <span className="text-xs opacity-80">(오늘 {remaining("quiz")}회 남음)</span>}
              </Button>
              <button type="button" className="w-full text-center text-sm text-ink-soft underline" onClick={() => setMaterial(null)}>
                다른 자료로 다시 정리하기
              </button>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function ChipRow<T extends string | number>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-ink-soft">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={cn("font-display rounded-full border-2 px-3 py-1 text-sm", value === o.id ? "border-accent bg-accent text-white" : "border-line")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
