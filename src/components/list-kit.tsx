"use client";

import { Search } from "lucide-react";
import { cn, Select, SkeletonRow, Spinner } from "@/components/ui";

/**
 * Shared toolbar + container primitives for directory lists, so Companies,
 * People and any future list wear the same search box, tab pills, sort control
 * and loading state. Purely presentational — data lives in useList().
 */

export function ListSearchField({
  value,
  onChange,
  placeholder,
  label,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  loading?: boolean;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <Search
        size={15}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-9 text-[15px] text-fg transition-colors placeholder:text-fg-subtle hover:border-fg-subtle/50 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {loading ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle">
          <Spinner />
        </span>
      ) : null}
    </div>
  );
}

export function TabPills<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; n: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-[13px] shadow-card">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
            active === t.id ? "bg-muted text-fg" : "text-fg-muted hover:text-fg",
          )}
        >
          {t.label}
          <span className="tnum rounded bg-card px-1.5 text-[11px] text-fg-subtle">{t.n}</span>
        </button>
      ))}
    </div>
  );
}

export function SortSelect<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  label: string;
}) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <span className="hidden text-[12px] text-fg-subtle sm:inline">Sort</span>
      <div className="w-44">
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          aria-label={label}
          className="h-9 text-[13px]"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
