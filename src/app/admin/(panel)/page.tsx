"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { adminApi } from "@/lib/admin/client";

interface Stats {
  users: { total: number; activeWeek: number; suspended: number };
  bank: { materials: number; quizzes: number; reuses: number };
  learn: { units: number; published: number };
  ai: { provider: string; configured: boolean; usage: { feature: string; label: string; used: number; limit: number }[] };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminApi<Stats>("/api/admin/stats").then(setStats, (e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl">대시보드</h1>
      {error && <p role="alert" className="text-danger">{error}</p>}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile href="/admin/users" label="사용자" value={stats.users.total} sub={`최근 7일 ${stats.users.activeWeek}명 · 정지 ${stats.users.suspended}명`} />
            <Tile href="/admin/content" label="모인 정리" value={stats.bank.materials} sub={`문제 세트 ${stats.bank.quizzes}개`} />
            <Tile href="/admin/content" label="다시 쓰인 횟수" value={stats.bank.reuses} sub="AI 호출을 아낀 횟수" />
            <Tile href="/admin/learn" label="학습 유닛" value={stats.learn.units} sub={`공개 ${stats.learn.published}개`} />
          </div>
          <Card className="space-y-2">
            <p className="font-display">AI: {stats.ai.provider} {stats.ai.configured ? "" : "(설정 안 됨)"}</p>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {stats.ai.usage.map((u) => (
                <li key={u.feature} className="flex justify-between gap-2 rounded-xl bg-surface-2 px-3 py-1.5">
                  <span>{u.label}</span>
                  <span className="tabular-nums text-ink-soft">
                    오늘 {u.used}/{u.limit}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="space-y-1 text-sm text-ink-soft">
            <p className="font-display text-ink">작업 순서</p>
            <p>1. AI 학습실에서 학생들이 만든 정리·문제가 <Link className="underline" href="/admin/content">자료 모음</Link>에 쌓여요. 틀린 설명은 여기서 고쳐요.</p>
            <p>2. <Link className="underline" href="/admin/learn">학습 과정</Link>에서 섹션을 고르고, 비슷한 자료를 골라 &lsquo;AI로 유닛 만들기&rsquo;를 하면 초안이 생겨요.</p>
            <p>3. 초안을 확인·수정한 뒤 공개하면 학생의 학습 탭에 나타나요.</p>
          </Card>
        </>
      )}
    </div>
  );
}

function Tile({ href, label, value, sub }: { href: string; label: string; value: number; sub: string }) {
  return (
    <Link href={href}>
      <Card className="h-full space-y-1">
        <p className="text-xs text-ink-soft">{label}</p>
        <p className="font-display text-3xl tabular-nums">{value}</p>
        <p className="text-xs text-ink-soft">{sub}</p>
      </Card>
    </Link>
  );
}
