"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Columns3,
  Database,
  HeartHandshake,
  Home,
  LogOut,
  Mail,
  Moon,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandBar } from "@/components/command-bar";

type Item = { href: string; label: string; icon: typeof Home };

const WORKSPACE: Item[] = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/contacts", label: "People", icon: Users },
  { href: "/care", label: "Care", icon: HeartHandshake },
];

const TOOLS: Item[] = [
  { href: "/templates", label: "Email templates", icon: Mail },
  { href: "/digest", label: "Weekly digest", icon: Sparkles },
  { href: "/data", label: "Data health", icon: Database },
];

// The navy→teal brand gradient — the app's one signature surface, used only on
// the logo mark so it stays special.
const BRAND_GRADIENT = "linear-gradient(135deg, var(--navy), var(--accent))";
// Coral identity mark for the account footer (matches the client CRM).
const CORAL_GRADIENT = "linear-gradient(135deg, #ffb8b8, #ff8e8e)";
// The subtle cyan→navy wash on the active nav row (matches the client CRM).
const NAV_ACTIVE = "linear-gradient(135deg, rgba(0,180,216,0.10) 0%, rgba(27,43,91,0.05) 100%)";

/**
 * Left sidebar app shell. Primary navigation lives here (grouped, always
 * visible — no "More" dropdown), with the brand lockup on top and an identity
 * + theme + sign-out footer at the bottom. Fixed on desktop, an off-canvas
 * drawer on mobile.
 */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  // Esc closes the mobile drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <>
      {open ? (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={onClose}
          className="fixed inset-0 z-30 bg-[rgba(11,18,32,0.45)] backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-border bg-surface transition-transform duration-200 ease-out",
          "lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0",
          open ? "translate-x-0 shadow-float lg:shadow-none" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand */}
        <Link
          href="/today"
          onClick={onClose}
          className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4"
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-lg text-white shadow-raise"
            style={{ background: BRAND_GRADIENT }}
          >
            <Moon size={16} strokeWidth={2} fill="currentColor" className="rotate-[18deg]" />
          </span>
          <span className="leading-tight">
            <span className="block text-[14px] font-bold tracking-tight text-fg">Luna Desk</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">
              TG B2B CRM
            </span>
          </span>
        </Link>

        {/* Quick find */}
        <div className="shrink-0 border-b border-border p-2.5">
          <CommandBar variant="sidebar" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          <NavGroup label="Workspace" items={WORKSPACE} pathname={pathname} onNavigate={onClose} />
          <div className="mt-4">
            <NavGroup label="Tools" items={TOOLS} pathname={pathname} onNavigate={onClose} />
          </div>
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-border p-2.5">
          <NavRow item={{ href: "/settings", label: "Settings", icon: Settings }} pathname={pathname} onNavigate={onClose} />
          <div className="mt-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
              style={{ background: CORAL_GRADIENT }}
              aria-hidden
            >
              TG
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12px] font-semibold text-fg">Travelgenix</span>
              <span className="block truncate text-[11px] text-fg-subtle">B2B CRM</span>
            </span>
            <ThemeToggle />
          </div>
          <button
            onClick={logout}
            className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-fg-muted transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <LogOut size={17} strokeWidth={1.75} /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

function NavGroup({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  items: Item[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div>
      <p className="px-3 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavRow key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function NavRow({
  item,
  pathname,
  onNavigate,
}: {
  item: Item;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      style={active ? { background: NAV_ACTIVE } : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active ? "font-semibold text-fg" : "font-medium text-fg-muted hover:bg-muted hover:text-fg",
      )}
    >
      <Icon size={17} strokeWidth={active ? 2 : 1.75} className="shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
