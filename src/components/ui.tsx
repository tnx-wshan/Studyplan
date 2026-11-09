import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "accent" | "success" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-[0_4px_0_var(--primary-deep)]",
  accent: "bg-accent text-white shadow-[0_4px_0_var(--accent-deep)]",
  success: "bg-success text-white shadow-[0_4px_0_var(--success-deep)]",
  ghost: "bg-surface text-ink border-2 border-line shadow-[0_4px_0_var(--line)]",
};

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Size = "sm" | "md" | "lg";

/** 게임 버튼 스타일: 누르면 아래로 눌리는 입체 버튼. 링크에도 같은 모양을 쓸 수 있다. */
export function buttonStyles(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "font-display inline-flex items-center justify-center gap-2 rounded-2xl transition-[transform,box-shadow] duration-75 select-none",
    "active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:active:translate-y-0",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent",
    size === "sm" && "px-3 py-1.5 text-sm",
    size === "md" && "px-5 py-2.5 text-base",
    size === "lg" && "px-6 py-3.5 text-lg",
    VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonStyles(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-3xl border-2 border-line bg-surface p-4 shadow-[var(--shadow)]", className)}
      {...props}
    />
  );
}

export function ProgressBar({
  value,
  color = "var(--xp)",
  className,
  label,
}: {
  value: number;
  color?: string;
  className?: string;
  label?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-4 w-full overflow-hidden rounded-full border-2 border-line bg-surface-2", className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: color, boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.12)" }}
      />
    </div>
  );
}

export function Pill({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-center gap-1 rounded-full border-2 border-line bg-surface px-2.5 py-1 text-sm",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="font-display text-lg">{children}</h2>
      {action}
    </div>
  );
}
