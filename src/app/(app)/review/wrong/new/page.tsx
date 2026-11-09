"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Field, PageHeader, Select, SubjectPicker, TextArea, TextInput, useSubjects } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { Button, Card, cn } from "@/components/ui";
import { unitsForSubject } from "@/data/curriculum";
import { addWrongAnswer } from "@/lib/db/study";
import type { WrongAnswer } from "@/lib/db/types";
import { compressImage } from "@/lib/image";
import { WRONG_REASONS } from "@/lib/study/wrongReasons";

export default function NewWrongPage() {
  const router = useRouter();
  const subjects = useSubjects() ?? [];
  const fileRef = useRef<HTMLInputElement>(null);
  const [subjectId, setSubjectId] = useState<string>();
  const [unit, setUnit] = useState("");
  const [question, setQuestion] = useState("");
  const [image, setImage] = useState<Blob>();
  const [myAnswer, setMyAnswer] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [reason, setReason] = useState<WrongAnswer["reason"]>("concept");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const subject = subjects.find((s) => s.id === subjectId);
  const units = subject ? unitsForSubject(subject) : [];

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : undefined), [image]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const valid = (question.trim() || image) && correctAnswer.trim();

  async function onSubmit(e: FormEvent, again = false) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    await addWrongAnswer({ subjectId, unitId: unit || undefined, question: question.trim(), myAnswer: myAnswer.trim(), correctAnswer: correctAnswer.trim(), reason, note: note.trim() || undefined }, image);
    toast("오답을 기록했어요. 내일 다시 풀어봐요!");
    if (again) {
      setQuestion("");
      setImage(undefined);
      setMyAnswer("");
      setCorrectAnswer("");
      setNote("");
      setSaving(false);
      window.scrollTo({ top: 0 });
    } else {
      router.replace("/review/wrong");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="오답 기록" back="/review/wrong" />
      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm text-ink-soft">과목</p>
            <SubjectPicker
              subjects={subjects}
              value={subjectId}
              onChange={(id) => {
                setSubjectId(id);
                setUnit("");
              }}
              allowNone
            />
          </div>
          {units.length > 0 && (
            <Field label="단원">
              <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="">선택 안 함</option>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </Card>

        <Card className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm text-ink-soft">문제 사진</p>
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- 업로드 미리보기 */}
                <img src={preview} alt="문제 사진 미리보기" className="max-h-72 w-full rounded-2xl object-contain" />
                <button type="button" onClick={() => setImage(undefined)} className="absolute right-2 top-2 rounded-full bg-ink/70 px-2.5 py-1 text-sm text-bg">
                  지우기
                </button>
              </div>
            ) : (
              <Button type="button" variant="ghost" className="w-full" onClick={() => fileRef.current?.click()}>
                📷 사진 찍기 / 고르기
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) setImage(await compressImage(f));
              }}
            />
          </div>
          <Field label={image ? "문제 내용 (선택)" : "문제 내용"}>
            <TextArea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="문제를 적거나 사진을 올려주세요" maxLength={2000} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="내가 쓴 답">
              <TextInput value={myAnswer} onChange={(e) => setMyAnswer(e.target.value)} maxLength={200} />
            </Field>
            <Field label="정답">
              <TextInput value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} maxLength={500} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-3">
          <p className="text-sm text-ink-soft">왜 틀렸나요?</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(WRONG_REASONS) as WrongAnswer["reason"][]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={reason === k}
                onClick={() => setReason(k)}
                className={cn("font-display rounded-2xl border-2 py-2 text-sm", reason === k ? "border-primary bg-bg-soft" : "border-line")}
              >
                {WRONG_REASONS[k].icon} {WRONG_REASONS[k].label}
              </button>
            ))}
          </div>
          <p className="rounded-2xl bg-surface-2 p-3 text-sm">💡 {WRONG_REASONS[reason].tip}</p>
          <Field label="메모 (선택)">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 부호를 바꾸는 걸 잊음" maxLength={200} />
          </Field>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" disabled={!valid || saving} onClick={(e) => onSubmit(e as unknown as FormEvent, true)}>
            저장하고 하나 더
          </Button>
          <Button type="submit" disabled={!valid || saving}>
            저장
          </Button>
        </div>
      </form>
    </div>
  );
}
