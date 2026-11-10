import Link from "next/link";
import { Card, buttonStyles } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <Card className="w-full space-y-3">
        <p className="kicker">404</p>
        <h1 className="font-display text-xl">없는 화면이에요</h1>
        <p className="text-sm text-ink-soft">주소가 바뀌었거나 지워진 화면이에요.</p>
        <Link href="/" className={buttonStyles("primary", "md", "w-full")}>
          홈으로
        </Link>
      </Card>
    </main>
  );
}
