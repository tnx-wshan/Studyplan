"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DialogHost } from "../Dialogs";
import { Toaster } from "../Toaster";
import { cn } from "../ui";

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/users", label: "사용자" },
  { href: "/admin/content", label: "자료 모음" },
  { href: "/admin/learn", label: "학습 과정" },
];

/** 관리 도구 공통 틀: 위쪽 메뉴, 넓은 화면 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    window.location.replace("/admin/login");
  }
  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <Link href="/admin" className="font-display text-lg">
          홈스터디 관리
        </Link>
        <nav aria-label="관리 메뉴" className="flex flex-1 flex-wrap gap-1">
          {NAV.map((n) => {
            const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("rounded-full px-3 py-1 text-sm", active ? "bg-accent text-white font-display" : "text-ink-soft")}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button type="button" onClick={logout} className="text-sm text-ink-soft underline">
          로그아웃
        </button>
      </header>
      <main>{children}</main>
      <Toaster />
      <DialogHost />
    </div>
  );
}

/** 관리 화면용 표 칸 */
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b-2 border-line px-2 py-2 text-left text-xs font-normal text-ink-soft", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-line px-2 py-2 align-top text-sm", className)}>{children}</td>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    active: ["이용 중", "border-success text-success-deep"],
    suspended: ["정지", "border-danger text-danger"],
    hidden: ["숨김", "border-line text-ink-soft"],
    draft: ["초안", "border-xp text-xp-deep"],
    published: ["공개", "border-success text-success-deep"],
  };
  const [label, cls] = map[status] ?? [status, "border-line"];
  return <span className={cn("inline-block whitespace-nowrap rounded-full border-2 px-2 py-0.5 text-xs", cls)}>{label}</span>;
}
