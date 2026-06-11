"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Briefcase, Building2, Columns3, HeartHandshake, Home, LogOut, Search, Users } from "lucide-react";
import { api } from "@/lib/client";
import type { Company, Contact } from "@/lib/crm/types";
import { cn, IconButton, Spinner } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { QuickAdd } from "@/components/quick-add";

const NAV = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/deals", label: "Deals", icon: Briefcase },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/care", label: "Care", icon: HeartHandshake },
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
        <Link href="/today" className="flex shrink-0 items-baseline gap-2">
          <span className="text-base font-semibold tracking-tight text-navy">Luna Desk</span>
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
                    ? "bg-muted text-fg"
                    : "text-fg-muted hover:bg-muted hover:text-fg",
                )}
              >
                <Icon size={16} strokeWidth={1.75} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <GlobalSearch />
          <QuickAdd />
          <ThemeToggle />
          <IconButton label="Sign out" onClick={logout}>
            <LogOut size={18} strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>
    </header>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ companies: Company[]; contacts: Contact[] }>({
    companies: [],
    contacts: [],
  });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults({ companies: [], contacts: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await api<{ companies: Company[]; contacts: Contact[] }>(
          `/api/search?q=${encodeURIComponent(term)}`,
        );
        setResults(data);
      } catch {
        setResults({ companies: [], contacts: [] });
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  const hasResults = results.companies.length > 0 || results.contacts.length > 0;

  return (
    <div ref={boxRef} className="relative">
      <Search
        size={15}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search..."
        aria-label="Search companies and contacts"
        className="w-36 rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-[13px] text-fg placeholder:text-fg-subtle focus-visible:w-52 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-44"
      />
      {open && q.trim().length >= 2 && (
        <div className="luna-fade absolute right-0 mt-1.5 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-[0_16px_40px_-12px_rgba(8,15,30,0.3)]">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-[13px] text-fg-subtle">
              <Spinner /> Searching...
            </div>
          )}
          {!loading && !hasResults && (
            <div className="px-4 py-3 text-[13px] text-fg-subtle">No matches</div>
          )}
          {!loading && results.companies.length > 0 && (
            <div className="border-b border-border-soft py-1">
              <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                Companies
              </p>
              {results.companies.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(`/companies/${c.id}`)}
                  className="block w-full px-4 py-1.5 text-left text-[13px] text-fg hover:bg-muted"
                >
                  {c.name}
                  {c.type ? <span className="ml-2 text-fg-subtle">{c.type}</span> : null}
                </button>
              ))}
            </div>
          )}
          {!loading && results.contacts.length > 0 && (
            <div className="py-1">
              <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                Contacts
              </p>
              {results.contacts.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(c.companyId ? `/companies/${c.companyId}` : "/contacts")}
                  className="block w-full px-4 py-1.5 text-left text-[13px] text-fg hover:bg-muted"
                >
                  {c.name}
                  {c.companyName ? <span className="ml-2 text-fg-subtle">{c.companyName}</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
