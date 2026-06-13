import { cn } from "@/lib/utils";
import { ReactNode } from "react";

// ── Pastel colour palette ─────────────────────────────────────────────────────
// Matches the reference screenshot: soft blue, lavender, mint green, warm yellow

export type PastelVariant = "blue" | "purple" | "green" | "yellow" | "gray" | "dark" | "white";

const variantCls: Record<PastelVariant, string> = {
  blue:   "bg-blue-50   border-blue-100   text-blue-900",
  purple: "bg-purple-50 border-purple-100 text-purple-900",
  green:  "bg-emerald-50 border-emerald-100 text-emerald-900",
  yellow: "bg-amber-50  border-amber-100  text-amber-900",
  gray:   "bg-slate-50  border-slate-200  text-slate-800",
  dark:   "bg-[#111111] border-neutral-800 text-white",
  white:  "bg-white     border-slate-200  text-slate-900",
};

const accentCls: Record<PastelVariant, string> = {
  blue:   "text-blue-500",
  purple: "text-purple-500",
  green:  "text-emerald-500",
  yellow: "text-amber-500",
  gray:   "text-slate-500",
  dark:   "text-[#FFD400]",
  white:  "text-slate-500",
};

// ── PastelCard ────────────────────────────────────────────────────────────────
// Full-width card with a pastel background. Use for primary stat/overview cards.

interface PastelCardProps {
  variant?: PastelVariant;
  className?: string;
  children: ReactNode;
}

export function PastelCard({ variant = "white", className, children }: PastelCardProps) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 shadow-sm",
      variantCls[variant],
      className
    )}>
      {children}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
// Number-first card. Shows a large metric with a label beneath and optional footer.

interface StatCardProps {
  variant?: PastelVariant;
  label: string;
  value: string | number;
  subValue?: string;
  footer?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export function StatCard({ variant = "white", label, value, subValue, footer, icon, badge, className }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 shadow-sm flex flex-col gap-2",
      variantCls[variant],
      className
    )}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{label}</p>
        {badge && <div className="shrink-0">{badge}</div>}
        {icon && <div className={cn("shrink-0", accentCls[variant])}>{icon}</div>}
      </div>
      <div>
        <p className="text-2xl font-bold leading-none tracking-tight">{value}</p>
        {subValue && <p className="mt-1 text-xs opacity-60">{subValue}</p>}
      </div>
      {footer && <div className="mt-auto pt-1">{footer}</div>}
    </div>
  );
}

// ── SectionTitle ──────────────────────────────────────────────────────────────
// Bold section heading with optional subtitle and right-side action slot.

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionTitle({ title, subtitle, action, className }: SectionTitleProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── PageTitle ─────────────────────────────────────────────────────────────────
// Large bold page heading with optional meta and right slot.

interface PageTitleProps {
  title: string;
  meta?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function PageTitle({ title, meta, right, className }: PageTitleProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 mb-5", className)}>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
        {meta && <div className="mt-1 text-xs text-slate-500">{meta}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// ── StatusPill ────────────────────────────────────────────────────────────────
// Readable status badge for tables and cards.

interface StatusPillProps {
  status?: string | null;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  const s = status.toLowerCase();
  const cls =
    s === "submitted" || s === "verified" || s === "balanced" || s === "match"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : s === "missing" || s === "failed" || s === "mismatch"
      ? "bg-red-100 text-red-800 border-red-200"
      : "bg-amber-100 text-amber-800 border-amber-200";
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold", cls, className)}>
      {status}
    </span>
  );
}
