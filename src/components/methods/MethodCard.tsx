import Link from "next/link";
import type { StudyMethod } from "@/data/methods";
import { cn } from "../ui";

export function EvidenceBadge({ level }: { level: StudyMethod["evidence"] }) {
  return (
    <span className={cn("font-display shrink-0 rounded-full px-2 py-0.5 text-[11px]", level === "high" ? "bg-success/15 text-success-deep" : "bg-accent/10 text-accent-deep")}>
      효과 근거 {level === "high" ? "높음" : "보통"}
    </span>
  );
}

export function MethodCard({ method, reason, compact }: { method: StudyMethod; reason?: string; compact?: boolean }) {
  return (
    <Link
      href={`/methods/detail?id=${method.id}`}
      className="flex items-start gap-3 rounded-3xl border-2 border-line bg-surface p-3 shadow-[var(--shadow)] transition-colors hover:border-accent"
    >
      <span aria-hidden className="text-3xl">
        {method.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-display">{method.name}</span>
          {!compact && <EvidenceBadge level={method.evidence} />}
        </span>
        <span className="mt-0.5 block text-sm text-ink-soft">{reason ?? method.oneLine}</span>
      </span>
      <span aria-hidden className="self-center text-ink-soft">
        ›
      </span>
    </Link>
  );
}
