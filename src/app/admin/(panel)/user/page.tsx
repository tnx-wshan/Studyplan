"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/admin/AdminShell";
import { askConfirm } from "@/components/Dialogs";
import { Field, Select, TextArea, TextInput } from "@/components/kit";
import { toast } from "@/components/Toaster";
import { Button, Card, SectionTitle } from "@/components/ui";
import { GRADES, SUBJECT_GROUPS } from "@/data/curriculum";
import { adminApi, ago, formatTime } from "@/lib/admin/client";
import { MAX_LEVEL, levelFromXp, xpForLevel } from "@/lib/game/level";
import { courseName, gradeShort } from "@/lib/learn/names";
import { courseKey, type CourseInfo, type CourseOutline } from "@/lib/learn/types";
import { COMMAND_LABELS, type StoredCommand, type UserCommand, type UserSnapshot } from "@/lib/sync/types";

interface UserDetail {
  id: string;
  nickname: string;
  grade: string;
  status: "active" | "suspended";
  memo: string;
  snapshot: Partial<UserSnapshot>;
  createdAt: number;
  lastSeenAt: number;
  commands: StoredCommand[];
}


export default function AdminUserPage() {
  return (
    <Suspense fallback={null}>
      <UserView />
    </Suspense>
  );
}

function UserView() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memo, setMemo] = useState("");

  const load = useCallback(
    () =>
      adminApi<{ user: UserDetail }>(`/api/admin/user?id=${encodeURIComponent(id)}`).then(
        (r) => {
          setUser(r.user);
          setMemo(r.user.memo);
        },
        (e: Error) => setError(e.message),
      ),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function send(command: UserCommand) {
    try {
      await adminApi("/api/admin/user/command", { method: "POST", body: { id, command } });
      toast(`${COMMAND_LABELS[command.type]}: 다음 접속 때 적용돼요`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "보내지 못했어요.");
    }
  }

  async function patch(body: { status?: "active" | "suspended"; memo?: string }) {
    try {
      await adminApi("/api/admin/user", { method: "PATCH", body: { id, ...body } });
      toast("저장했어요");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "저장하지 못했어요.");
    }
  }

  if (error) return <p role="alert" className="text-danger">{error}</p>;
  if (!user) return <p className="text-ink-soft">불러오는 중…</p>;
  const s = user.snapshot;
  const pending = user.commands.filter((c) => c.appliedAt === null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/users" className="text-sm underline">
          ‹ 사용자 목록
        </Link>
        <h1 className="font-display flex-1 text-2xl">
          {user.nickname || "(이름 없음)"} <span className="text-base text-ink-soft">{gradeShort(user.grade)}</span>
        </h1>
        <StatusBadge status={user.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Mini label="레벨" value={`Lv.${s.level ?? 0}`} />
        <Mini label="경험치" value={String(s.totalXp ?? 0)} />
        <Mini label="코인" value={String(s.coins ?? 0)} />
        <Mini label="연속 학습" value={`${s.streak ?? 0}일 (최장 ${s.longestStreak ?? 0})`} />
        <Mini label="학습 탭 (오늘/주)" value={`${Math.round((s.learnTodaySec ?? 0) / 60)}분 / ${Math.round((s.learnWeekSec ?? 0) / 60)}분`} />
      </div>
      <p className="text-xs text-ink-soft">
        마지막 접속 {ago(user.lastSeenAt)} · 처음 접속 {formatTime(user.createdAt)} · 마지막 공부한 날 {s.lastStudyDate ?? "-"}
      </p>

      <section>
        <SectionTitle>상태와 메모</SectionTitle>
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {user.status === "active" ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  if (await askConfirm(`${user.nickname}의 이용을 정지할까요? 학생 화면이 잠기고 AI·학습 요청이 막혀요.`, { confirmLabel: "정지", danger: true })) await patch({ status: "suspended" });
                }}
              >
                🔒 이용 정지
              </Button>
            ) : (
              <Button variant="success" onClick={() => patch({ status: "active" })}>
                🔓 정지 풀기
              </Button>
            )}
            <span className="text-xs text-ink-soft">정지하면 학생 화면이 잠기고, 기기 데이터는 그대로 남아요.</span>
          </div>
          <Field label="관리자 메모 (학생에게 보이지 않아요)">
            <TextArea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={1000} />
          </Field>
          <Button size="sm" variant="ghost" disabled={memo === user.memo} onClick={() => patch({ memo })}>
            메모 저장
          </Button>
        </Card>
      </section>

      <section>
        <SectionTitle>값 고치기</SectionTitle>
        <EditValues user={user} onSend={send} />
      </section>

      <section>
        <SectionTitle>학습 진도</SectionTitle>
        <LearnProgressEditor user={user} onSend={send} />
      </section>

      <section>
        <SectionTitle>보낸 명령</SectionTitle>
        <Card className="p-2">
          {user.commands.length === 0 ? (
            <p className="p-2 text-sm text-ink-soft">아직 없어요.</p>
          ) : (
            <ul className="divide-y divide-line">
              {user.commands.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                  <span className="font-display">{COMMAND_LABELS[c.type]}</span>
                  <span className="text-xs text-ink-soft">{describe(c)}</span>
                  <span className="ml-auto text-xs text-ink-soft">{c.appliedAt ? `적용됨 ${formatTime(c.appliedAt)}` : "적용 대기"}</span>
                  {c.appliedAt === null && (
                    <button
                      type="button"
                      className="text-xs text-danger underline"
                      onClick={async () => {
                        await adminApi(`/api/admin/user/command?id=${id}&commandId=${c.id}`, { method: "DELETE" }).catch((e) => toast(e.message));
                        await load();
                      }}
                    >
                      취소
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {pending.length > 0 && <p className="p-2 text-xs text-xp-deep">적용 대기 중인 명령이 {pending.length}개 있어요. 학생이 앱을 열면 적용돼요.</p>}
        </Card>
      </section>

      <Button
        variant="ghost"
        className="text-danger"
        onClick={async () => {
          if (!(await askConfirm("목록에서 이 사용자를 지울까요? 학생 기기의 데이터는 지워지지 않고, 다시 접속하면 목록에 다시 나타나요.", { confirmLabel: "지우기", danger: true }))) return;
          await adminApi(`/api/admin/user?id=${id}`, { method: "DELETE" });
          router.push("/admin/users");
        }}
      >
        목록에서 지우기
      </Button>
    </div>
  );
}

function describe(c: StoredCommand): string {
  const p = c.payload as Record<string, unknown>;
  switch (c.type) {
    case "setXp":
      return `경험치 ${p.totalXp} (Lv.${levelFromXp(Number(p.totalXp)).level})`;
    case "setCoins":
      return `코인 ${p.coins}`;
    case "setFreezes":
      return `보호권 ${p.freezes}개`;
    case "setNickname":
      return `${p.nickname}`;
    default:
      return String(p.unitId ?? p.courseKey ?? "");
  }
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="font-display tabular-nums">{value}</p>
    </Card>
  );
}

function EditValues({ user, onSend }: { user: UserDetail; onSend: (c: UserCommand) => Promise<void> }) {
  const s = user.snapshot;
  const [level, setLevel] = useState(String(s.level ?? 0));
  const [xp, setXp] = useState(String(s.totalXp ?? 0));
  const [coins, setCoins] = useState(String(s.coins ?? 0));
  const [freezes, setFreezes] = useState(String(Math.min(2, s.freezes ?? 0)));
  const [nickname, setNickname] = useState(user.nickname);
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

  return (
    <Card className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Field label="레벨 (그 레벨의 시작 경험치로 맞춰요)">
          <TextInput type="number" min={0} max={MAX_LEVEL} value={level} onChange={(e) => setLevel(e.target.value)} />
        </Field>
        <Button size="sm" variant="ghost" onClick={() => onSend({ type: "setXp", payload: { totalXp: xpForLevel(num(level)) } })}>
          레벨 적용
        </Button>
      </div>
      <div className="space-y-2">
        <Field label="총 경험치">
          <TextInput type="number" min={0} value={xp} onChange={(e) => setXp(e.target.value)} />
        </Field>
        <Button size="sm" variant="ghost" onClick={() => onSend({ type: "setXp", payload: { totalXp: num(xp) } })}>
          경험치 적용 (Lv.{levelFromXp(num(xp)).level})
        </Button>
      </div>
      <div className="space-y-2">
        <Field label="코인">
          <TextInput type="number" min={0} value={coins} onChange={(e) => setCoins(e.target.value)} />
        </Field>
        <Button size="sm" variant="ghost" onClick={() => onSend({ type: "setCoins", payload: { coins: num(coins) } })}>
          코인 적용
        </Button>
      </div>
      <div className="space-y-2">
        <Field label="연속 기록 보호권 (0~2)">
          <Select value={freezes} onChange={(e) => setFreezes(e.target.value)}>
            {[0, 1, 2].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </Select>
        </Field>
        <Button size="sm" variant="ghost" onClick={() => onSend({ type: "setFreezes", payload: { freezes: num(freezes) } })}>
          보호권 적용
        </Button>
      </div>
      <div className="space-y-2">
        <Field label="이름">
          <TextInput value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} />
        </Field>
        <Button size="sm" variant="ghost" disabled={!nickname.trim() || nickname === user.nickname} onClick={() => onSend({ type: "setNickname", payload: { nickname: nickname.trim() } })}>
          이름 적용
        </Button>
      </div>
    </Card>
  );
}

function LearnProgressEditor({ user, onSend }: { user: UserDetail; onSend: (c: UserCommand) => Promise<void> }) {
  const current = user.snapshot.learnCourse?.split(":");
  const [grade, setGrade] = useState(current?.[0] || user.grade || "m1");
  const [subject, setSubject] = useState(current?.[1] || "math");
  const [outline, setOutline] = useState<CourseOutline | null>(null);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  useEffect(() => {
    adminApi<{ courses: CourseInfo[]; outline: CourseOutline }>(`/api/admin/learn?grade=${grade}&subject=${subject}`).then(
      (r) => {
        setOutline(r.outline);
        setCourses(r.courses);
      },
      () => setOutline(null),
    );
  }, [grade, subject]);
  const done = new Set(user.snapshot.learnDone ?? []);
  const pending = new Map<string, string>();
  for (const c of user.commands) if (c.appliedAt === null && "unitId" in c.payload) pending.set(String(c.payload.unitId), c.type);
  const key = courseKey(grade, subject);

  return (
    <Card className="space-y-3">
      <p className="text-sm text-ink-soft">
        지금 고른 코스: {user.snapshot.learnCourse ? courseName(...(user.snapshot.learnCourse.split(":") as [string, string])) : "없음"} · 끝낸 유닛 {done.size}개
      </p>
      <div className="flex flex-wrap gap-2">
        <Select aria-label="학년" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-auto">
          {GRADES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </Select>
        <Select aria-label="과목" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-auto">
          {SUBJECT_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label} ({courses.find((c) => c.grade === grade && c.subject === g.id)?.units ?? 0})
            </option>
          ))}
        </Select>
      </div>
      {outline && outline.sections.every((s) => s.units.length === 0) && <p className="text-sm text-ink-soft">이 코스에는 유닛이 없어요.</p>}
      {outline && (
        <ul className="space-y-3">
          {outline.sections
            .filter((s) => s.units.length > 0)
            .map((s) => (
              <li key={s.id}>
                <p className="font-display text-sm">{s.title}</p>
                <ul className="mt-1 space-y-1">
                  {s.units.map((u) => {
                    const isDone = done.has(u.id);
                    const wait = pending.get(u.id);
                    return (
                      <li key={u.id} className="flex items-center gap-2 text-sm">
                        <span aria-hidden>{isDone ? "✅" : "⬜"}</span>
                        <span className="flex-1">
                          {u.title} {u.status === "draft" && <StatusBadge status="draft" />}
                        </span>
                        {wait ? (
                          <span className="text-xs text-xp-deep">{wait === "learnComplete" ? "완료 표시 대기" : "지우기 대기"}</span>
                        ) : isDone ? (
                          <button type="button" className="text-xs underline" onClick={() => onSend({ type: "learnReset", payload: { unitId: u.id } })}>
                            진도 지우기
                          </button>
                        ) : (
                          <button type="button" className="text-xs underline" onClick={() => onSend({ type: "learnComplete", payload: { unitId: u.id, courseKey: key } })}>
                            완료로 표시
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
        </ul>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          if (await askConfirm(`${courseName(grade, subject)} 코스의 진도를 모두 지울까요?`, { confirmLabel: "모두 지우기", danger: true })) await onSend({ type: "learnResetCourse", payload: { courseKey: key } });
        }}
      >
        이 코스 진도 모두 지우기
      </Button>
    </Card>
  );
}
