"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Building2, Columns3, Database, HeartHandshake, Home, LogOut, Moon, MoreHorizontal, Settings, Sparkles, Users } from "lucide-react";
import { cn } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { QuickAdd } from "@/components/quick-add";
import { CommandBar } from "@/components/command-bar";

// Four everyday destinations up top; the rest live in the More menu so a
// first-time user isn't faced with seven tabs at once.
const NAV = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/contacts", label: "People", icon: Users },
  { href: "/care", label: "Care", icon: HeartHandshake },
];

const MORE = [
  { href: "/digest", label: "Weekly digest", icon: Sparkles },
  { href: "/data", label: "Data health", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
        <Link href="/today" className="flex shrink-0 items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-navy text-white shadow-raise">
            <Moon size={15} strokeWidth={2} fill="currentColor" className="rotate-[18deg]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-navy">Luna Desk</span>
          <span className="hidden text-[11px] font-medium uppercase tracking-wide text-fg-subtle sm:inline">
            TG B2B CRM
          </span>
        </Link>

        <nav className="ml-2 flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-accent-strong"
                    : "text-fg-muted hover:bg-muted hover:text-fg",
                )}
              >
                <Icon size={16} strokeWidth={1.75} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <CommandBar />
          <ThemeToggle />
          <MoreMenu onLogout={logout} />
        </div>

        {/* Trigger-less: hosts the Task / Note / LinkedIn modals opened via the
            command bar and Today's quick actions (the `luna:quickadd` event). */}
        <QuickAdd showTrigger={false} />
      </div>
    </header>
  );
}

function MoreMenu({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const activeInMore = MORE.some(
    (m) => pathname === m.href || pathname.startsWith(`${m.href}/`),
  );

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          activeInMore || open ? "bg-muted text-fg" : "text-fg-muted hover:bg-muted hover:text-fg",
        )}
      >
        <MoreHorizontal size={18} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="luna-pop shadow-float absolute right-0 mt-1.5 w-48 origin-top-right overflow-hidden rounded-xl border border-border bg-card py-1"
        >
          {MORE.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <button
                key={item.href}
                role="menuitem"
                onClick={() => go(item.href)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-colors",
                  active ? "bg-muted text-fg" : "text-fg-muted hover:bg-muted hover:text-fg",
                )}
              >
                <Icon size={16} strokeWidth={1.75} /> {item.label}
              </button>
            );
          })}
          <div className="my-1 border-t border-border-soft" />
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-fg-muted transition-colors hover:bg-muted hover:text-fg"
          >
            <LogOut size={16} strokeWidth={1.75} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
