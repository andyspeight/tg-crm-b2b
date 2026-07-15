"use client";

import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
} from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Info, X } from "lucide-react";
import Link from "next/link";

export function cn(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(" ");
}

// --- Button -----------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-btn text-btn-fg border border-transparent shadow-raise hover:brightness-[1.05] hover:-translate-y-px",
  secondary:
    "bg-card text-fg border border-border shadow-card hover:border-accent-soft hover:-translate-y-px",
  ghost: "bg-transparent text-fg-muted border border-transparent hover:bg-muted hover:text-fg",
  danger: "bg-transparent text-danger border border-border hover:border-danger/50 hover:bg-danger/10",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "text-[13px] h-9 px-3 gap-1.5",
  md: "text-[14px] h-11 px-4 gap-2",
  lg: "text-[15px] h-12 px-5 gap-2.5",
};

const BUTTON_BASE =
  "inline-flex cursor-pointer items-center justify-center rounded-lg font-medium " +
  "transition-[transform,filter,background-color,border-color,box-shadow] duration-150 active:translate-y-0 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)] " +
  "disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  );
}

/** A next/link styled identically to <Button> — for navigational actions. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}>
      {children}
    </Link>
  );
}

export function IconButton({
  className,
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-muted hover:text-fg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// --- Inputs -----------------------------------------------------------------

const FIELD_BASE =
  "w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-fg transition-colors " +
  "placeholder:text-fg-subtle hover:border-fg-subtle/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD_BASE, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD_BASE, "min-h-24 resize-y py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(FIELD_BASE, "h-11 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[13px] text-fg-subtle">{hint}</span> : null}
    </label>
  );
}

// --- Badge ------------------------------------------------------------------

export type BadgeColor = "neutral" | "navy" | "accent" | "success" | "warning" | "danger" | "info";

const BADGE_TOKEN: Record<Exclude<BadgeColor, "neutral">, string> = {
  navy: "--color-navy",
  accent: "--color-accent-strong",
  success: "--color-success",
  warning: "--color-warning",
  danger: "--color-danger",
  info: "--color-info",
};

export function Badge({ color = "neutral", children }: { color?: BadgeColor; children: ReactNode }) {
  const base =
    "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";
  if (color === "neutral") {
    return <span className={cn(base, "bg-muted text-fg-muted")}>{children}</span>;
  }
  const c = `var(${BADGE_TOKEN[color]})`;
  return (
    <span
      className={base}
      style={{
        color: c,
        backgroundColor: `color-mix(in srgb, ${c} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 26%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

// --- Modal ------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="luna-fade fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[rgba(11,18,32,0.6)] p-4 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="luna-pop shadow-float relative z-10 my-4 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card sm:my-0">
        <div className="flex items-center justify-between gap-3 border-b border-border-soft px-6 py-4">
          <h2 className="text-[16px] font-semibold tracking-tight text-fg">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </IconButton>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// --- misc -------------------------------------------------------------------

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-surface px-4 py-9 text-center">
      {icon ? (
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-accent-soft/60 text-accent-strong">
          {icon}
        </span>
      ) : null}
      <p className="text-[15px] font-medium text-fg-muted">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-sm text-[13px] text-fg-subtle">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

// --- Card + page header -----------------------------------------------------

export function Card({
  className,
  interactive,
  children,
}: {
  className?: string;
  interactive?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card shadow-card",
        interactive && "transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-raise",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? <p className="mt-1 text-[13px] text-fg-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-[13px] text-danger">{children}</p>;
}

// --- Monogram + identity ----------------------------------------------------

/** Initials from a name — first letter of the first and last words. */
export function initials(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Monogram({
  name,
  size = "sm",
  tone = "accent",
}: {
  name?: string;
  size?: "sm" | "lg";
  tone?: "accent" | "navy";
}) {
  const dims = size === "lg" ? "h-12 w-12 rounded-xl text-[15px]" : "h-8 w-8 rounded-lg text-[12px]";
  const toneClass = tone === "navy" ? "bg-navy text-white" : "bg-accent-soft text-accent-strong";
  return (
    <span className={cn("grid shrink-0 place-items-center font-semibold", dims, toneClass)} aria-hidden>
      {initials(name)}
    </span>
  );
}

// --- InlineAlert ------------------------------------------------------------

export function InlineAlert({
  variant = "danger",
  children,
}: {
  variant?: "danger" | "success" | "info";
  children: ReactNode;
}) {
  if (!children) return null;
  const map = {
    danger: { cls: "border-danger/30 bg-danger/10 text-danger", Icon: AlertCircle },
    success: { cls: "border-success/30 bg-success/10 text-success", Icon: CheckCircle2 },
    info: { cls: "border-info/30 bg-info/10 text-info", Icon: Info },
  }[variant];
  const Icon = map.Icon;
  return (
    <div
      className={cn("luna-fade flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px]", map.cls)}
      role="alert"
    >
      <Icon size={15} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

// --- StatTile ---------------------------------------------------------------

export function StatTile({
  label,
  value,
  sub,
  tone,
  icon,
  onClick,
  active,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn" | "danger" | "success" | "navy";
  icon?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const ring =
    tone === "danger"
      ? "ring-danger/30"
      : tone === "warn"
        ? "ring-warning/30"
        : tone === "success"
          ? "ring-success/30"
          : "ring-transparent";
  const valueColor =
    tone === "danger"
      ? "text-danger"
      : tone === "warn"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-fg";
  const chip =
    tone === "danger"
      ? "bg-danger/15 text-danger"
      : tone === "warn"
        ? "bg-warning/15 text-warning"
        : tone === "success"
          ? "bg-success/15 text-success"
          : tone === "navy"
            ? "bg-navy/10 text-navy"
            : "bg-accent-soft text-accent-strong";
  const inner = (
    <>
      {icon ? <span className={cn("mb-2 grid h-8 w-8 place-items-center rounded-xl", chip)}>{icon}</span> : null}
      <span className={cn("tnum text-[24px] font-semibold leading-none", valueColor)}>{value}</span>
      <span className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</span>
      {sub ? <span className="mt-0.5 text-[11px] text-fg-subtle">{sub}</span> : null}
    </>
  );
  const base = cn(
    "flex flex-col rounded-2xl border border-border bg-card p-3.5 text-left shadow-card ring-1 ring-inset",
    ring,
    active && "ring-2 ring-accent",
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          base,
          "cursor-pointer transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-raise focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        )}
      >
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}

// --- Skeleton (loading) -----------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
    </div>
  );
}
