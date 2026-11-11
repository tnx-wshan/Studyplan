"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LessonPlayer } from "@/components/learn/LessonPlayer";
import { buttonStyles } from "@/components/ui";
import { fetchUnit } from "@/lib/learn/client";
import type { LearnSection, LearnUnit } from "@/lib/learn/types";

type Unit = LearnUnit & { section: LearnSection };

export default function LessonPage() {
  return (
    <Suspense fallback={null}>
      <Lesson />
    </Suspense>
  );
}

function Lesson() {
  const router = useRouter();
  const id = useSearchParams().get("unit") ?? "";
  const [loaded, setLoaded] = useState<{ id: string; unit?: Unit; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUnit(id)
      .then((r) => !cancelled && setLoaded({ id, unit: r.data }))
      .catch((e) => !cancelled && setLoaded({ id, error: e instanceof Error ? e.message : "유닛을 불러오지 못했어요." }));
    return () => {
      cancelled = true;
    };
  }, [id]);
  const unit = loaded?.id === id ? loaded.unit : null;
  const error = loaded?.id === id ? loaded.error : null;

  if (error) {
    return (
      <div className="space-y-4 pt-10 text-center">
        <p role="alert" className="text-danger">
          {error}
        </p>
        <Link href="/learn" className={buttonStyles("ghost")}>
          학습 지도로
        </Link>
      </div>
    );
  }
  if (!unit) return <p className="pt-10 text-center text-ink-soft">유닛을 불러오는 중…</p>;
  return <LessonPlayer key={unit.id + unit.updatedAt} unit={unit} onExit={() => router.push("/learn")} />;
}
