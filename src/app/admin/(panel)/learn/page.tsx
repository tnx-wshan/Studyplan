"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/admin/AdminShell";
import { askConfirm, askText } from "@/components/Dialogs";
import { Field, Select, TextInput } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { Button, Card, buttonStyles, cn } from "@/components/ui";
import { GRADES, SUBJECT_GROUPS, coursesFor, curriculumSourceLabel, type GradeId, type SubjectGroup } from "@/data/curriculum";
import { baseCourseFor, baseSectionDescription } from "@/data/learn/baseCurriculum";
import { adminApi } from "@/lib/admin/client";
import { gradeShort } from "@/lib/learn/names";
import type { CourseInfo, CourseOutline, LearnSubject } from "@/lib/learn/types";

type Section = CourseOutline["sections"][number];

export default function AdminLearn() {
  const router = useRouter();
  const [grade, setGrade] = useState("m1");
  const [subject, setSubject] = useState("math");
  const [, setCourses] = useState<CourseInfo[]>([]);
  const [subjects, setSubjects] = useState<LearnSubject[]>([]);
  const [addingSubject, setAddingSubject] = useState(false);
  const [outline, setOutline] = useState<CourseOutline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiFor, setAiFor] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);
  const [baseFilling, setBaseFilling] = useState(false);

  const load = useCallback(
    () =>
      adminApi<{ courses: CourseInfo[]; outline: CourseOutline; subjects: LearnSubject[] }>(`/api/admin/learn?grade=${grade}&subject=${subject}`).then(
        (r) => {
          setCourses(r.courses);
          setSubjects(r.subjects);
          setOutline(r.outline);
          setError(null);
        },
        (e: Error) => setError(e.message),
      ),
    [grade, subject],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function call(url: string, method: string, body?: unknown) {
    try {
      const r = await adminApi(url, { method, body });
      await load();
      return r;
    } catch (e) {
      toast(e instanceof Error ? e.message : "처리하지 못했어요.");
      return null;
    }
  }

  async function addSection() {
    const title = await askText("새 섹션(목차) 이름", { confirmLabel: "만들기" });
    if (title?.trim()) await call("/api/admin/learn/section", "POST", { grade, subject, title: title.trim() });
  }

  async function newUnit(section: Section) {
    const title = await askText(`'${section.title}'에 만들 유닛 이름`, { confirmLabel: "만들기" });
    if (!title?.trim()) return;
    const r = (await call("/api/admin/learn/unit", "POST", {
      sectionId: section.id,
      title: title.trim(),
      steps: [{ type: "summary", title: title.trim(), body: "여기에 핵심 정리를 쓰세요.", points: [] }],
    })) as { unit: { id: string } } | null;
    if (r) router.push(`/admin/learn/unit?id=${r.unit.id}`);
  }

  const current = subjects.find((s) => s.key === subject);

  async function renameSubject() {
    if (!current || current.builtIn) return;
    const name = await askText("과목 이름", { value: current.name });
    if (name?.trim()) await call("/api/admin/learn/subject", "PUT", { grade, key: current.key, name: name.trim() });
  }

  async function removeSubject() {
    if (!current || current.builtIn) return;
    if (!(await askConfirm(`'${current.name}' 과목과 그 안의 섹션·유닛을 모두 지울까요?`, { confirmLabel: "지우기", danger: true }))) return;
    try {
      await adminApi(`/api/admin/learn/subject?grade=${grade}&key=${current.key}`, { method: "DELETE" });
      setSubject("math");
    } catch (e) {
      toast(e instanceof Error ? e.message : "지우지 못했어요.");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">학습 과정</h1>
      <p className="text-sm text-ink-soft">코스(학년 × 과목) → 섹션(목차) → 유닛(2~3분). 초안은 학생에게 보이지 않고, 공개하면 학습 탭에 나타나요.</p>
      <div className="flex flex-wrap gap-2">
        <Select
          aria-label="학년"
          value={grade}
          onChange={(e) => {
            setGrade(e.target.value);
            // 추가한 과목은 학년마다 다르다
            if (!SUBJECT_GROUPS.some((g) => g.id === subject)) setSubject("math");
          }}
          className="w-auto"
        >
          {GRADES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </Select>
        <Select aria-label="과목" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-auto">
          {(subjects.length ? subjects : SUBJECT_GROUPS.map((g) => ({ key: g.id, name: g.label, units: 0, builtIn: true }))).map((s) => (
            <option key={s.key} value={s.key}>
              {s.name} (유닛 {s.units}){s.builtIn ? "" : " · 추가한 과목"}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="ghost" aria-expanded={addingSubject} onClick={() => setAddingSubject(!addingSubject)}>
          + 과목
        </Button>
        {current && !current.builtIn && (
          <>
            <Button size="sm" variant="ghost" onClick={renameSubject}>
              과목 이름 바꾸기
            </Button>
            <Button size="sm" variant="ghost" className="text-danger" onClick={removeSubject}>
              과목 지우기
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={addSection}>
          + 섹션
        </Button>
        <Link href="/admin/learn/import" className={buttonStyles("accent", "sm")}>
          ⤓ 일괄 넣기
        </Link>
        <Button size="sm" variant="ghost" aria-expanded={baseFilling} onClick={() => setBaseFilling(!baseFilling)}>
          학기별 기본 단원으로 섹션 채우기…
        </Button>
        <Button size="sm" variant="ghost" aria-expanded={filling} onClick={() => setFilling(!filling)}>
          교육과정 대표 단원으로 섹션 채우기…
        </Button>
      </div>
      <p className="text-xs text-ink-soft">
        코스 기준: {GRADES.find((g) => g.id === grade)?.label} · {GRADES.find((g) => g.id === grade)?.curriculum} 개정 교육과정. 섹션은 모든 학생이 함께 보는 목차예요(출판사별로 나뉘지 않아요).
      </p>
      {addingSubject && (
        <SubjectForm
          grade={grade}
          onDone={async (key) => {
            setAddingSubject(false);
            setSubject(key);
          }}
        />
      )}
      {baseFilling && (
        <BaseFill
          key={`${grade}:${subject}`}
          grade={grade as GradeId}
          subject={subject}
          subjectName={current?.name ?? ""}
          existing={new Set(outline?.sections.map((s) => s.title) ?? [])}
          onDone={async (added) => {
            setBaseFilling(false);
            toast(`섹션 ${added}개를 만들었어요 (학기별 기본 단원).`);
            await load();
          }}
        />
      )}
      {filling && (
        <CurriculumFill
          key={`${grade}:${subject}`}
          grade={grade}
          subject={subject}
          group={current?.group ?? null}
          existing={new Set(outline?.sections.map((s) => s.title) ?? [])}
          onDone={async (added, source) => {
            setFilling(false);
            toast(`섹션 ${added}개를 만들었어요 (${source}).`);
            await load();
          }}
        />
      )}
      {error && <p role="alert" className="text-danger">{error}</p>}
      {outline && outline.sections.length === 0 && <Card className="text-sm text-ink-soft">{gradeShort(grade)} 코스에 아직 섹션이 없어요. 섹션을 만들거나 교육과정 대표 단원으로 채우세요.</Card>}

      <ol className="space-y-3">
        {outline?.sections.map((s, i) => (
          <li key={s.id}>
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-soft">섹션 {i + 1}</span>
                <h2 className="font-display flex-1 text-lg">
                  {s.title}
                  {s.description && <span className="block text-xs font-normal text-ink-soft">{s.description}</span>}
                </h2>
                <IconBtn label={`${s.title} 위로`} onClick={() => call("/api/admin/learn/section", "PUT", { id: s.id, move: -1 })}>
                  ↑
                </IconBtn>
                <IconBtn label={`${s.title} 아래로`} onClick={() => call("/api/admin/learn/section", "PUT", { id: s.id, move: 1 })}>
                  ↓
                </IconBtn>
                <IconBtn
                  label={`${s.title} 이름 바꾸기`}
                  onClick={async () => {
                    const title = await askText("섹션 이름", { value: s.title });
                    if (title?.trim()) await call("/api/admin/learn/section", "PUT", { id: s.id, title: title.trim() });
                  }}
                >
                  ✎
                </IconBtn>
                <IconBtn
                  label={`${s.title} 지우기`}
                  onClick={async () => {
                    if (await askConfirm(`'${s.title}' 섹션과 그 안의 유닛 ${s.units.length}개를 지울까요?`, { confirmLabel: "지우기", danger: true })) await call(`/api/admin/learn/section?id=${s.id}`, "DELETE");
                  }}
                >
                  🗑
                </IconBtn>
              </div>
              {s.units.length > 0 && (
                <ul className="divide-y divide-line rounded-2xl border-2 border-line">
                  {s.units.map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <Link href={`/admin/learn/unit?id=${u.id}`} className="font-display flex-1 underline">
                        {u.title}
                      </Link>
                      <span className="text-xs text-ink-soft">
                        문제 {u.questionCount} · {u.minutes}분
                      </span>
                      <StatusBadge status={u.status} />
                      <IconBtn label={`${u.title} 위로`} onClick={() => call("/api/admin/learn/unit", "PUT", { id: u.id, move: -1 })}>
                        ↑
                      </IconBtn>
                      <IconBtn label={`${u.title} 아래로`} onClick={() => call("/api/admin/learn/unit", "PUT", { id: u.id, move: 1 })}>
                        ↓
                      </IconBtn>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => newUnit(s)}>
                  + 빈 유닛
                </Button>
                <Button size="sm" variant="accent" onClick={() => setAiFor(aiFor === s.id ? null : s.id)}>
                  ✨ AI로 유닛 만들기
                </Button>
              </div>
              {aiFor === s.id && <AiUnitMaker section={s} onMade={(id) => router.push(`/admin/learn/unit?id=${id}`)} />}
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="rounded-lg border-2 border-line px-2 py-0.5 text-sm">
      {children}
    </button>
  );
}

interface Suggestion {
  id: string;
  title: string;
  topic: string;
  grade: string;
  quizzes: number;
  uses: number;
  score: number;
}

/** 섹션에 어울리는 자료를 골라 AI가 겹치는 내용을 합쳐 유닛 초안을 만든다 */
function AiUnitMaker({ section, onMade }: { section: Section; onMade: (unitId: string) => void }) {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi<{ items: Suggestion[] }>(`/api/admin/learn/suggest?sectionId=${section.id}`).then(
      (r) => {
        setItems(r.items);
        setPicked(r.items.filter((x) => x.score >= 0.5).slice(0, 4).map((x) => x.id));
      },
      (e) => setError(e.message),
    );
  }, [section.id]);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi<{ unit: { id: string }; dropped: string[] }>("/api/admin/learn/generate", { method: "POST", body: { sectionId: section.id, itemIds: picked, focus: focus.trim() || undefined } });
      if (r.dropped.length) toast(`모양이 잘못된 문제 ${r.dropped.length}개는 뺐어요.`);
      onMade(r.unit.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "만들지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl bg-surface-2 p-3">
      <p className="text-sm">재료로 쓸 자료를 고르세요 (최대 8개). 같은 과목 자료 중 섹션 이름과 비슷한 순서예요.</p>
      {items === null && !error && <p className="text-sm text-ink-soft">찾는 중…</p>}
      {items && items.length === 0 && <p className="text-sm text-ink-soft">이 과목에 모인 자료가 없어요. 학생들이 AI 학습실에서 자료를 만들면 여기에 나타나요.</p>}
      {items && items.length > 0 && (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {items.map((it) => (
            <li key={it.id}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 accent-[var(--accent)]"
                  checked={picked.includes(it.id)}
                  disabled={!picked.includes(it.id) && picked.length >= 8}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, it.id] : picked.filter((x) => x !== it.id))}
                />
                <span>
                  {it.title} <span className="text-xs text-ink-soft">({it.topic} · {gradeShort(it.grade) || "학년?"} · 문제 {it.quizzes}세트 · 비슷함 {Math.round(it.score * 100)}%)</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <TextInput value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="특히 다룰 주제 (선택)" aria-label="특히 다룰 주제" maxLength={100} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button size="sm" variant="accent" disabled={busy || picked.length === 0} onClick={make}>
        {busy ? "AI가 만드는 중… (10~40초)" : `자료 ${picked.length}개로 유닛 초안 만들기`}
      </Button>
    </div>
  );
}

/**
 * 교육과정 대표 단원으로 섹션 채우기: 기준과 만들어질 섹션을 먼저 보여준다.
 * 과목에 교육과정 과목이 여럿(고등학교 선택과목 등)이면 하나를 고른다.
 */
function CurriculumFill({ grade, subject, group, existing, onDone }: { grade: string; subject: string; group: SubjectGroup | null; existing: Set<string>; onDone: (added: number, source: string) => void }) {
  // 추가한 과목(예: 수학Ⅰ)은 '비슷한 기본 과목'의 교육과정 과목에서 고른다
  const list = group ? coursesFor(grade as GradeId, group) : [];
  const [courseId, setCourseId] = useState(list.length === 1 ? list[0].id : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const course = list.find((c) => c.id === courseId);
  const fresh = course ? course.units.filter((u) => !existing.has(u)) : [];

  async function fill() {
    if (!course) return;
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi<{ added: number; source: string }>("/api/admin/learn/section", { method: "POST", body: { grade, subject, fromCurriculum: true, courseId: course.id } });
      onDone(r.added, r.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "만들지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3" role="region" aria-label="교육과정 대표 단원으로 섹션 채우기">
      <p className="text-sm">
        <b>출판사 교과서의 목차가 아니라 교육과정의 대표 단원</b>으로 섹션을 만들어요. 교과서마다 단원 이름과 순서가 조금 달라서, 필요하면 만든 뒤 이름을 고치세요.
      </p>
      {list.length === 0 && <p className="text-sm text-ink-soft">이 과목에는 교육과정 대표 단원 자료가 없어요. &lsquo;+ 섹션&rsquo;이나 일괄 넣기로 교과서 목차를 넣어 주세요.</p>}
      {list.length > 1 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="교육과정 과목">
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={courseId === c.id}
              onClick={() => setCourseId(c.id)}
              className={cn("rounded-full border-2 px-3 py-1 text-sm", courseId === c.id ? "border-accent bg-accent text-white" : "border-line")}
            >
              {c.name}
              {c.units.length === 0 && " (단원 자료 없음)"}
            </button>
          ))}
        </div>
      )}
      {course && (
        <>
          <p className="font-display text-sm">기준: {curriculumSourceLabel(course)}</p>
          {course.units.length === 0 ? (
            <p className="text-sm text-ink-soft">{course.name}은(는) 대표 단원 자료가 없어요. &lsquo;+ 섹션&rsquo;으로 교과서 목차를 직접 만들어 주세요.</p>
          ) : (
            <ol className="list-decimal space-y-0.5 pl-6 text-sm" aria-label="만들어질 섹션">
              {course.units.map((u) => (
                <li key={u} className={existing.has(u) ? "text-ink-soft" : undefined}>
                  {u}
                  {existing.has(u) && " (이미 있음)"}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button size="sm" disabled={!course || fresh.length === 0 || busy} onClick={fill}>
        {course ? `섹션 ${fresh.length}개 만들기` : "교육과정 과목을 골라 주세요"}
      </Button>
    </Card>
  );
}

/** 학년·과목·학기별 기본 단원(src/data/learn/baseCurriculum.ts)에서 빠진 섹션을 덧붙인다 */
function BaseFill({ grade, subject, subjectName, existing, onDone }: { grade: GradeId; subject: string; subjectName: string; existing: Set<string>; onDone: (added: number) => void }) {
  const course = baseCourseFor(grade, subject, subjectName);
  const fresh = course ? course.sections.filter((s) => !existing.has(s[1])) : [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fill() {
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi<{ added: number }>("/api/admin/learn/section", { method: "POST", body: { grade, subject, fromBase: true } });
      onDone(r.added);
    } catch (e) {
      setError(e instanceof Error ? e.message : "만들지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3" role="region" aria-label="학기별 기본 단원으로 섹션 채우기">
      <p className="text-sm">
        여러 교과서의 목차를 모은 <b>학년·학기별 대단원</b>으로 섹션을 만들어요. 섹션 설명에 학기와 중단원이 들어가고, 일괄 넣기 지시문이 이 중단원을 뼈대로 유닛을 나눠요. 이미 있는 섹션은 그대로 두고 빠진 것만 끝에 덧붙여요.
      </p>
      {!course ? (
        <p className="text-sm text-ink-soft">이 과목에는 기본 단원 자료가 없어요. &lsquo;+ 섹션&rsquo;이나 일괄 넣기로 목차를 넣어 주세요.</p>
      ) : (
        <ol className="list-decimal space-y-1 pl-6 text-sm" aria-label="기본 단원 섹션">
          {course.sections.map((s) => (
            <li key={s[1]} className={existing.has(s[1]) ? "text-ink-soft" : undefined}>
              <b className="font-normal">{s[1]}</b>
              {existing.has(s[1]) && " (이미 있음)"}
              <span className="block text-xs text-ink-soft">{baseSectionDescription(course, s)}</span>
            </li>
          ))}
        </ol>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button size="sm" disabled={!course || fresh.length === 0 || busy} onClick={fill}>
        {course && fresh.length === 0 ? "빠진 섹션이 없어요" : `섹션 ${fresh.length}개 만들기`}
      </Button>
    </Card>
  );
}

/** 과목 추가: 이름, 아이콘 글자, 비슷한 기본 과목(수식 도구·재료 추천·교육과정 대표 단원에 씀) */
function SubjectForm({ grade, onDone }: { grade: string; onDone: (key: string) => void }) {
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [group, setGroup] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi<{ subject: LearnSubject }>("/api/admin/learn/subject", { method: "POST", body: { grade, name: name.trim(), short: short.trim() || undefined, group: group || null } });
      toast(`과목 '${r.subject.name}'을(를) 추가했어요.`);
      onDone(r.subject.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "추가하지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3" role="region" aria-label="과목 추가">
      <p className="text-sm">
        {GRADES.find((g) => g.id === grade)?.label}에 과목을 추가해요. 예: 수학2, 수학Ⅰ, 역사, 체육, 미술, 음악, 기술·가정, 정보
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="과목 이름">
          <TextInput value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="예: 수학2" />
        </Field>
        <Field label="아이콘 글자 (1~2글자, 선택)">
          <TextInput value={short} maxLength={2} onChange={(e) => setShort(e.target.value)} placeholder={name.slice(0, 2) || "수2"} />
        </Field>
        <Field label="비슷한 기본 과목">
          <Select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">없음 (체육·예술 등)</option>
            {SUBJECT_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-xs text-ink-soft">비슷한 기본 과목을 고르면 수식 도구(수학), 자료 모음 재료 추천, 교육과정 대표 단원 채우기가 그 과목 기준으로 동작해요.</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button size="sm" disabled={!name.trim() || busy} onClick={add}>
        과목 추가
      </Button>
    </Card>
  );
}
