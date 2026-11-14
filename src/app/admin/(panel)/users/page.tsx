"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge, Td, Th } from "@/components/admin/AdminShell";
import { TextInput } from "@/components/kit";
import { Card } from "@/components/ui";
import { adminApi, ago } from "@/lib/admin/client";
import { courseName, gradeShort } from "@/lib/learn/names";
import type { UserSnapshot } from "@/lib/sync/types";

interface Row {
  id: string;
  email: string;
  nickname: string;
  grade: string;
  status: string;
  memo: string;
  snapshot: Partial<UserSnapshot>;
  lastSeenAt: number;
  pendingCommands: number;
  learnByCourse: Record<string, number>;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    adminApi<{ users: Row[] }>("/api/admin/users").then((r) => setUsers(r.users), (e) => setError(e.message));
  }, []);
  const shown = useMemo(() => (users ?? []).filter((u) => !q.trim() || u.nickname.includes(q.trim()) || u.email.includes(q.trim().toLowerCase()) || u.memo.includes(q.trim())), [users, q]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">사용자</h1>
      <p className="text-sm text-ink-soft">학생 기기가 앱을 열 때와 5분마다 요약을 보내요. 여기서 고친 값은 그 기기가 다음에 접속할 때 적용돼요.</p>
      <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·메일·메모로 찾기" aria-label="사용자 찾기" className="max-w-xs" />
      {error && <p role="alert" className="text-danger">{error}</p>}
      {users && users.length === 0 && <Card className="text-sm text-ink-soft">아직 접속한 사용자가 없어요.</Card>}
      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border-2 border-line bg-surface" tabIndex={0} role="region" aria-label="사용자 표 (옆으로 밀어서 보기)">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <Th>이름</Th>
                <Th>메일주소</Th>
                <Th>학년</Th>
                <Th>상태</Th>
                <Th>레벨 · 경험치</Th>
                <Th>연속</Th>
                <Th>학습 진도</Th>
                <Th>마지막 접속</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  <Td>
                    <Link href={`/admin/user?id=${u.id}`} className="font-display underline">
                      {u.nickname || "(이름 없음)"}
                    </Link>
                    {u.pendingCommands > 0 && <span className="ml-1 text-xs text-xp-deep">적용 대기 {u.pendingCommands}</span>}
                    {u.memo && <p className="text-xs text-ink-soft">{u.memo.slice(0, 30)}</p>}
                  </Td>
                  <Td className="break-all text-xs">{u.email || "-"}</Td>
                  <Td>{gradeShort(u.grade)}</Td>
                  <Td>
                    <StatusBadge status={u.status} />
                  </Td>
                  <Td className="tabular-nums">
                    Lv.{u.snapshot.level ?? 0} · {u.snapshot.totalXp ?? 0}
                  </Td>
                  <Td className="tabular-nums">{u.snapshot.streak ?? 0}일</Td>
                  <Td>
                    {Object.entries(u.learnByCourse).length === 0
                      ? <span className="text-ink-soft">-</span>
                      : Object.entries(u.learnByCourse).map(([k, n]) => {
                          const [g, s] = k.split(":");
                          return (
                            <span key={k} className="mr-2 whitespace-nowrap text-xs">
                              {courseName(g, s)} {n}개
                            </span>
                          );
                        })}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-soft">{ago(u.lastSeenAt)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
