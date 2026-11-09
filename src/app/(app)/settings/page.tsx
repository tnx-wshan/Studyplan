"use client";

import { useRef, useState } from "react";
import { applyTheme } from "@/components/ThemeSync";
import { Button, Card, SectionTitle, cn } from "@/components/ui";
import { GRADES, SUBJECT_GROUPS, coursesFor, gradeLabel, type GradeId } from "@/data/curriculum";
import { exportBackup, importBackup } from "@/lib/db/backup";
import { updateProfile } from "@/lib/db/profile";
import { useProfile } from "@/lib/hooks";

const THEMES = [
  { id: "system", label: "기기 설정" },
  { id: "light", label: "밝게" },
  { id: "dark", label: "어둡게" },
] as const;

export default function SettingsPage() {
  const profile = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!profile) return null;

  async function onExport() {
    const json = await exportBackup();
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `homestudy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("백업 파일을 저장했어요.");
  }

  async function onImport(file: File) {
    if (!confirm("지금 기기의 데이터를 백업 파일 내용으로 바꿀까요? 되돌릴 수 없어요.")) return;
    try {
      await importBackup(await file.text());
      setMessage("백업을 불러왔어요.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "불러오지 못했어요.");
    }
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl">⚙️ 설정</h1>

      <section>
        <SectionTitle>내 정보</SectionTitle>
        <Card className="space-y-3">
          <Field label="닉네임" value={profile.nickname} onSave={(v) => updateProfile({ nickname: v })} />
          <Field label="펫 이름" value={profile.pet.name} onSave={(v) => updateProfile({ pet: { ...profile.pet, name: v } })} />
          <Field label="목표" value={profile.goal} onSave={(v) => updateProfile({ goal: v })} allowEmpty />
          <label className="block space-y-1">
            <span className="text-sm text-ink-soft">학년</span>
            <select
              value={profile.grade}
              onChange={(e) => updateProfile({ grade: e.target.value as GradeId })}
              className="w-full rounded-2xl border-2 border-line bg-surface px-3 py-2.5"
            >
              {GRADES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </Card>
      </section>

      <section>
        <SectionTitle>화면</SectionTitle>
        <Card className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={profile.theme === t.id}
              onClick={() => {
                applyTheme(t.id);
                updateProfile({ theme: t.id });
              }}
              className={cn(
                "font-display rounded-2xl border-2 py-2 text-sm",
                profile.theme === t.id ? "border-primary bg-bg-soft text-primary-deep" : "border-line",
              )}
            >
              {t.label}
            </button>
          ))}
        </Card>
      </section>

      <section>
        <SectionTitle>{gradeLabel(profile.grade)} 교육과정</SectionTitle>
        <Card className="space-y-3">
          {SUBJECT_GROUPS.map((s) => (
            <details key={s.id} className="group">
              <summary className="font-display flex cursor-pointer items-center gap-2">
                <span className="inline-block size-3 rounded-full" style={{ background: s.color }} />
                {s.label}
                <span className="text-sm text-ink-soft">
                  {coursesFor(profile.grade, s.id)
                    .map((c) => c.name)
                    .join(", ")}
                </span>
              </summary>
              <ul className="mt-2 space-y-2 pl-5 text-sm">
                {coursesFor(profile.grade, s.id).map((c) => (
                  <li key={c.id}>
                    <p className="font-display">{c.name}</p>
                    <p className="text-ink-soft">{c.units.length ? c.units.join(" · ") : "단원은 과목 관리에서 직접 추가해요(1단계)."}</p>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <p className="text-xs text-ink-soft">교과서마다 단원 이름이 조금씩 달라서 대표 단원만 넣어두었어요.</p>
        </Card>
      </section>

      <section>
        <SectionTitle>데이터</SectionTitle>
        <Card className="space-y-3">
          <p className="text-sm text-ink-soft">
            지금은 데이터가 이 기기의 브라우저에만 저장돼요. 브라우저 데이터를 지우면 사라지니 가끔 백업해 주세요.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onExport}>
              💾 백업 내보내기
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              📂 백업 불러오기
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = "";
              }}
            />
          </div>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </Card>
      </section>

      <Button variant="ghost" className="w-full" onClick={onLogout}>
        잠그기 (로그아웃)
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onSave,
  allowEmpty,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  allowEmpty?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const changed = draft.trim() !== value && (allowEmpty || draft.trim());
  return (
    <label className="block space-y-1">
      <span className="text-sm text-ink-soft">{label}</span>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-w-0 flex-1 rounded-2xl border-2 border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
        />
        {changed && (
          <Button size="sm" type="button" onClick={() => onSave(draft.trim())}>
            저장
          </Button>
        )}
      </div>
    </label>
  );
}
