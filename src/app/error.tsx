"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, Card, buttonStyles } from "@/components/ui";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <Card className="w-full space-y-3">
        <p className="kicker">Error</p>
        <h1 className="font-display text-xl">화면을 불러오다 문제가 생겼어요</h1>
        <p className="text-sm text-ink-soft">공부 기록은 기기에 안전하게 저장되어 있어요. 다시 시도해도 안 되면 앱을 새로 고쳐 주세요.</p>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/" className={buttonStyles("ghost", "md")}>
            홈으로
          </Link>
          <Button onClick={() => retry()}>다시 시도</Button>
        </div>
      </Card>
    </main>
  );
}
