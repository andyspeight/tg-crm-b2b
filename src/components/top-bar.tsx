"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Company, Contact } from "@/lib/crm/types";
import { cn, Spinner } from "@/components/ui";

const NAV = [
  { href: "/companies", label: "Companies" },
  { href: "/contacts", label: "Contacts" },
  { href: "/deals", label: "Deals" },
];

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href="/companies" className="flex items-baseline gap-2 shrink-0">
          <span className="text-base font-semibold text-slate-900">Luna Desk</span>
          <span className="hidden text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:inline">
            TG B2B CRM
          </span>
        </Link>

        <nav className="ml-2 flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <GlobalSearch />
          <button
            onClick={logout}
            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            Sign out
          </button>
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
    }, 200);
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
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search..."
        className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-48"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute right-0 mt-1.5 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
              <Spinner /> Searching...
            </div>
          )}
          {!loading && !hasResults && (
            <div className="px-4 py-3 text-sm text-slate-400">No matches</div>
          )}
          {!loading && results.companies.length > 0 && (
            <div className="border-b border-slate-100 py-1">
              <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Companies
              </p>
              {results.companies.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(`/companies/${c.id}`)}
                  className="block w-full px-4 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {c.name}
                  {c.type ? <span className="ml-2 text-xs text-slate-400">{c.type}</span> : null}
                </button>
              ))}
            </div>
          )}
          {!loading && results.contacts.length > 0 && (
            <div className="py-1">
              <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Contacts
              </p>
              {results.contacts.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(c.companyId ? `/companies/${c.companyId}` : "/contacts")}
                  className="block w-full px-4 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {c.name}
                  {c.companyName ? (
                    <span className="ml-2 text-xs text-slate-400">{c.companyName}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
