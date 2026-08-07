"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Check,
  CornerDownLeft,
  HeartHandshake,
  Linkedin,
  ListPlus,
  Search,
  Sparkles,
  StickyNote,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { api } from "@/lib/client";
import type { Company, Contact } from "@/lib/crm/types";
import { cn, Spinner } from "@/components/ui";
import { AddLeadModal } from "@/components/add-lead-modal";

/**
 * The one bar. Search, create and Ask Luna used to be three separate controls
 * in the top bar (a live-search box, a "+" menu and an "Ask Luna" button that
 * confusingly also owned ⌘K). This merges them into a single ⌘K palette:
 * type to jump to a company or person, run a create command, or ask Luna a
 * question in natural language — the answer renders in place.
 *
 * Create commands reuse the existing modals: New lead/customer open
 * AddLeadModal here; Log note / Add task / LinkedIn import fire the
 * `luna:quickadd` event that the (now trigger-less) QuickAdd modal listens for.
 */

type SearchResults = { companies: Company[]; contacts: Contact[] };

type AskResult = {
  type: "company" | "contact" | "deal";
  id: string;
  name: string;
  sub?: string;
  href: string;
};
type AskProposal = {
  type: "task" | "care_touch" | "note";
  summary: string;
  params: Record<string, unknown>;
};
type AskResponse = { answer: string; results: AskResult[]; proposals: AskProposal[] };

const RESULT_ICON = { company: Building2, contact: User, deal: Briefcase } as const;
const PROPOSAL_ICON = { task: ListPlus, care_touch: HeartHandshake, note: StickyNote } as const;

const EXAMPLES = [
  "How's my pipeline looking?",
  "Which customers are Amber or Red?",
  "Deals with no next step",
  "UK tour operators we haven't spoken to in 60 days",
];

// A create command. `keywords` widen what the query matches beyond the label.
type Command = {
  id: string;
  label: string;
  icon: typeof UserPlus;
  keywords: string;
  run: () => void;
};

// One selectable row in the palette, in render order, for keyboard nav.
type Item =
  | { key: string; kind: "ask"; run: () => void }
  | { key: string; kind: "record"; name: string; sub?: string; type: "company" | "contact"; href: string; run: () => void }
  | { key: string; kind: "command"; label: string; icon: typeof UserPlus; run: () => void };

function fireQuickAdd(mode: "task" | "note" | "linkedin") {
  window.dispatchEvent(new CustomEvent("luna:quickadd", { detail: { mode } }));
}

export function CommandBar({ variant = "bar" }: { variant?: "bar" | "sidebar" } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>({ companies: [], contacts: [] });
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const [leadMode, setLeadMode] = useState<"Prospect" | "Customer" | null>(null);

  // Ask mode: when the user asks Luna, we swap the list for the answer panel.
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [askRes, setAskRes] = useState<AskResponse | null>(null);
  const [askedText, setAskedText] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const inAsk = asking || askRes !== null || askError !== null;

  const close = useCallback(() => setOpen(false), []);

  // Reset transient state whenever the palette closes.
  useEffect(() => {
    if (!open) {
      setQ("");
      setResults({ companies: [], contacts: [] });
      setActive(0);
      setAsking(false);
      setAskError(null);
      setAskRes(null);
      setAskedText("");
    }
  }, [open]);

  // ⌘K / Ctrl-K toggles the palette; Esc closes (or leaves ask mode first).
  // `luna:command-open` lets other chrome (e.g. the mobile top-strip button,
  // where the sidebar trigger is out of reach) open it too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("luna:command-open", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("luna:command-open", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Live record search, debounced. Mirrors the old global search.
  useEffect(() => {
    const term = q.trim();
    setActive(0);
    if (term.length < 2) {
      setResults({ companies: [], contacts: [] });
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await api<SearchResults>(`/api/search?q=${encodeURIComponent(term)}`);
        setResults(data);
      } catch {
        setResults({ companies: [], contacts: [] });
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const runAsk = useCallback(async (question: string) => {
    const query = question.trim();
    if (!query) return;
    setAskedText(query);
    setAsking(true);
    setAskError(null);
    setAskRes(null);
    try {
      const data = await api<AskResponse>("/api/ai/ask", {
        method: "POST",
        body: JSON.stringify({ question: query }),
      });
      setAskRes(data);
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAsking(false);
    }
  }, []);

  function leaveAsk() {
    setAsking(false);
    setAskError(null);
    setAskRes(null);
    setAskedText("");
    setTimeout(() => inputRef.current?.focus(), 20);
  }

  const commands = useMemo<Command[]>(
    () => [
      { id: "lead", label: "New lead", icon: UserPlus, keywords: "prospect add person contact", run: () => { close(); setLeadMode("Prospect"); } },
      { id: "customer", label: "New customer", icon: Building2, keywords: "account company client add", run: () => { close(); setLeadMode("Customer"); } },
      { id: "deal", label: "New deal", icon: Briefcase, keywords: "pipeline opportunity add", run: () => { close(); router.push("/deals?new=1"); } },
      { id: "note", label: "Log note", icon: StickyNote, keywords: "activity call meeting log add", run: () => { close(); fireQuickAdd("note"); } },
      { id: "task", label: "Add task", icon: ListPlus, keywords: "todo reminder follow up", run: () => { close(); fireQuickAdd("task"); } },
      { id: "linkedin", label: "Import from LinkedIn", icon: Linkedin, keywords: "paste url enrich profile", run: () => { close(); fireQuickAdd("linkedin"); } },
    ],
    [close, router],
  );

  const term = q.trim().toLowerCase();
  const companyItems = results.companies.slice(0, 6);
  const contactItems = results.contacts.slice(0, 6);
  const visibleCommands = useMemo(
    () =>
      term
        ? commands.filter((c) => c.label.toLowerCase().includes(term) || c.keywords.includes(term))
        : commands,
    [commands, term],
  );

  // The flat, ordered list the arrow keys walk: Ask → records → commands.
  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    if (term) list.push({ key: "ask", kind: "ask", run: () => runAsk(q) });
    for (const c of companyItems)
      list.push({ key: `co:${c.id}`, kind: "record", name: c.name, sub: c.type, type: "company", href: `/companies/${c.id}`, run: () => { close(); router.push(`/companies/${c.id}`); } });
    for (const c of contactItems)
      list.push({ key: `ct:${c.id}`, kind: "record", name: c.name, sub: c.companyName ?? c.role, type: "contact", href: c.companyId ? `/companies/${c.companyId}` : "/contacts", run: () => { close(); router.push(c.companyId ? `/companies/${c.companyId}` : "/contacts"); } });
    for (const c of visibleCommands)
      list.push({ key: `cmd:${c.id}`, kind: "command", label: c.label, icon: c.icon, run: c.run });
    return list;
  }, [term, q, companyItems, contactItems, visibleCommands, runAsk, router, close]);

  const activeIdx = items.length ? Math.min(active, items.length - 1) : 0;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (inAsk) leaveAsk();
      else close();
      return;
    }
    if (inAsk) return;
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[activeIdx]?.run();
    }
  }

  return (
    <>
      {/* Trigger. In the sidebar it's a full-width "Quick find" field; in a bar
          it's a search field on desktop and an icon on mobile. */}
      {variant === "sidebar" ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Search or ask Luna"
          aria-keyshortcuts="Meta+K Control+K"
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-muted px-2.5 text-left text-[13px] text-fg-subtle transition-colors hover:border-fg-subtle/40 hover:text-fg-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Search size={15} strokeWidth={1.9} className="shrink-0" aria-hidden />
          <span className="flex-1 truncate">Quick find…</span>
          <kbd className="rounded border border-border bg-card px-1 text-[10px] font-medium text-fg-muted">⌘K</kbd>
        </button>
      ) : (
        <>
          <button
            onClick={() => setOpen(true)}
            aria-label="Search or ask Luna"
            aria-keyshortcuts="Meta+K Control+K"
            className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-transparent bg-muted px-3 text-left text-[13.5px] text-fg-subtle transition-colors hover:bg-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:inline-flex"
          >
            <Search size={15} strokeWidth={1.9} className="shrink-0" aria-hidden />
            <span className="flex-1 truncate">Search or ask Luna…</span>
            <kbd className="rounded border border-border bg-card px-1 text-[10px] font-medium text-fg-muted">⌘K</kbd>
          </button>
          <button
            onClick={() => setOpen(true)}
            aria-label="Search or ask Luna"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:hidden"
          >
            <Search size={18} strokeWidth={1.9} />
          </button>
        </>
      )}

      {open && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search or ask Luna">
            <button
              aria-hidden
              tabIndex={-1}
              onClick={close}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <div className="luna-pop shadow-float relative mx-auto mt-[9vh] flex w-[92%] max-w-xl origin-top flex-col overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border-soft px-3">
                {inAsk ? (
                  <button
                    type="button"
                    onClick={leaveAsk}
                    aria-label="Back to search"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <ArrowLeft size={16} strokeWidth={1.9} />
                  </button>
                ) : (
                  <Search size={17} strokeWidth={1.9} className="shrink-0 text-fg-subtle" aria-hidden />
                )}
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Search people, companies — or ask Luna anything…"
                  aria-label="Search or ask Luna"
                  className="h-12 flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-subtle focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X size={16} strokeWidth={1.9} />
                </button>
              </div>

              <div className="max-h-[62vh] overflow-y-auto">
                {inAsk ? (
                  <div className="p-4">
                    {asking ? (
                      <p className="flex items-center gap-2 text-[13px] text-fg-subtle">
                        <Spinner /> Luna is thinking…
                      </p>
                    ) : askError ? (
                      <div className="space-y-1">
                        <p className="text-[13px] text-danger">{askError}</p>
                        <p className="text-[12px] text-fg-subtle">
                          If this says AI isn&apos;t configured, set <code>ANTHROPIC_API_KEY</code> in Vercel.
                        </p>
                      </div>
                    ) : askRes ? (
                      <Answer res={askRes} asked={askedText} onNavigate={close} />
                    ) : null}
                  </div>
                ) : (
                  <Browse
                    q={q}
                    term={term}
                    searching={searching}
                    companyItems={companyItems}
                    contactItems={contactItems}
                    visibleCommands={visibleCommands}
                    items={items}
                    activeIdx={activeIdx}
                    setActive={setActive}
                    onAsk={() => runAsk(q)}
                    onExample={(ex) => { setQ(ex); runAsk(ex); }}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      <AddLeadModal open={leadMode !== null} mode={leadMode ?? "Prospect"} onClose={() => setLeadMode(null)} />
    </>
  );
}

function Browse({
  q,
  term,
  searching,
  companyItems,
  contactItems,
  visibleCommands,
  items,
  activeIdx,
  setActive,
  onAsk,
  onExample,
}: {
  q: string;
  term: string;
  searching: boolean;
  companyItems: Company[];
  contactItems: Contact[];
  visibleCommands: Command[];
  items: Item[];
  activeIdx: number;
  setActive: (n: number) => void;
  onAsk: () => void;
  onExample: (ex: string) => void;
}) {
  // Map an item's position in the flat list to its index, so hover/selection
  // stay in sync with keyboard nav.
  const indexOfKey = (key: string) => items.findIndex((i) => i.key === key);
  const hasResults = companyItems.length > 0 || contactItems.length > 0;

  return (
    <div className="py-1.5">
      {term ? (
        <Row
          icon={<Sparkles size={15} strokeWidth={1.9} />}
          accent
          name={`Ask Luna: “${q.trim()}”`}
          sub="Natural-language answer from your CRM"
          active={activeIdx === indexOfKey("ask")}
          onMouseEnter={() => setActive(indexOfKey("ask"))}
          onClick={onAsk}
          trailing={<CornerDownLeft size={13} strokeWidth={2} className="text-fg-subtle" aria-hidden />}
        />
      ) : null}

      {searching ? (
        <p className="flex items-center gap-2 px-4 py-3 text-[13px] text-fg-subtle">
          <Spinner /> Searching…
        </p>
      ) : term && !hasResults ? (
        <p className="px-4 py-3 text-[13px] text-fg-subtle">
          No people or companies match “{q.trim()}”.
        </p>
      ) : null}

      {companyItems.length > 0 && (
        <Group label="Companies">
          {companyItems.map((c) => (
            <Row
              key={c.id}
              icon={<Building2 size={15} strokeWidth={1.75} />}
              name={c.name}
              sub={c.type}
              active={activeIdx === indexOfKey(`co:${c.id}`)}
              onMouseEnter={() => setActive(indexOfKey(`co:${c.id}`))}
              href={`/companies/${c.id}`}
            />
          ))}
        </Group>
      )}

      {contactItems.length > 0 && (
        <Group label="People">
          {contactItems.map((c) => (
            <Row
              key={c.id}
              icon={<User size={15} strokeWidth={1.75} />}
              name={c.name}
              sub={c.companyName ?? c.role}
              active={activeIdx === indexOfKey(`ct:${c.id}`)}
              onMouseEnter={() => setActive(indexOfKey(`ct:${c.id}`))}
              href={c.companyId ? `/companies/${c.companyId}` : "/contacts"}
            />
          ))}
        </Group>
      )}

      {visibleCommands.length > 0 && (
        <Group label={term ? "Actions" : "Create"}>
          {visibleCommands.map((c) => {
            const Icon = c.icon;
            return (
              <Row
                key={c.id}
                icon={<Icon size={15} strokeWidth={1.75} />}
                name={c.label}
                active={activeIdx === indexOfKey(`cmd:${c.id}`)}
                onMouseEnter={() => setActive(indexOfKey(`cmd:${c.id}`))}
                onClick={c.run}
              />
            );
          })}
        </Group>
      )}

      {!term ? (
        <div className="border-t border-border-soft px-3 pb-2 pt-3">
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            Ask Luna
          </p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => onExample(ex)}
                className="rounded-lg border border-border-soft bg-surface px-2.5 py-1.5 text-left text-[13px] text-fg-muted transition-colors hover:border-border hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pb-0.5">
      <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
      {children}
    </div>
  );
}

function Row({
  icon,
  name,
  sub,
  accent,
  active,
  href,
  onClick,
  onMouseEnter,
  trailing,
}: {
  icon: React.ReactNode;
  name: string;
  sub?: string;
  accent?: boolean;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  trailing?: React.ReactNode;
}) {
  const inner = (
    <>
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
          accent ? "bg-navy/10 text-navy" : "bg-accent-soft text-accent-strong",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-fg">{name}</span>
        {sub ? <span className="block truncate text-[11px] text-fg-subtle">{sub}</span> : null}
      </span>
      {trailing ?? null}
    </>
  );
  const cls = cn(
    "mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors focus-visible:outline-none",
    active ? "bg-muted" : "hover:bg-muted",
  );
  if (href) {
    return (
      <Link href={href} onMouseEnter={onMouseEnter} aria-selected={active} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} onMouseEnter={onMouseEnter} aria-selected={active} className={cn(cls, "w-[calc(100%-1rem)]")}>
      {inner}
    </button>
  );
}

function Answer({ res, asked, onNavigate }: { res: AskResponse; asked: string; onNavigate: () => void }) {
  return (
    <div className="space-y-3">
      {asked ? <p className="text-[12px] text-fg-subtle">“{asked}”</p> : null}

      <div className="space-y-2 text-[14px] leading-relaxed text-fg">
        {res.answer.split(/\n+/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {res.proposals.length > 0 ? (
        <div className="space-y-1.5">
          {res.proposals.map((p, i) => (
            <ProposalCard key={i} proposal={p} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}

      {res.results.length > 0 ? (
        <div className="border-t border-border-soft pt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Mentioned</p>
          <div className="space-y-1">
            {res.results.map((r) => {
              const Icon = RESULT_ICON[r.type];
              return (
                <Link
                  key={`${r.type}:${r.id}`}
                  href={r.href}
                  onClick={onNavigate}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Icon size={15} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
                  <span className="truncate text-[13px] font-medium text-fg">{r.name}</span>
                  {r.sub ? <span className="truncate text-[12px] text-fg-subtle">{r.sub}</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProposalCard({ proposal, onNavigate }: { proposal: AskProposal; onNavigate: () => void }) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [href, setHref] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const Icon = PROPOSAL_ICON[proposal.type];

  async function confirm() {
    setStatus("saving");
    try {
      const data = await api<{ ok: boolean; message: string; record?: { name: string; href: string } }>(
        "/api/ai/act",
        { method: "POST", body: JSON.stringify({ action: { type: proposal.type, params: proposal.params } }) },
      );
      setMessage(data.message || "Done.");
      setHref(data.record?.href ?? null);
      setStatus("done");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't do that.");
      setStatus("error");
    }
  }

  if (dismissed) return null;

  if (status === "done") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-[13px]">
        <Check size={15} strokeWidth={2.2} className="shrink-0 text-success" aria-hidden />
        <span className="flex-1 text-fg">{message}</span>
        {href ? (
          <Link
            href={href}
            onClick={onNavigate}
            className="shrink-0 text-[12px] font-medium text-accent-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Open
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-accent-soft bg-accent-soft/30 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Icon size={16} strokeWidth={1.9} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
        <p className="flex-1 text-[13px] text-fg">{proposal.summary}</p>
      </div>
      {status === "error" ? <p className="mt-1 pl-6 text-[12px] text-danger">{message}</p> : null}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          disabled={status === "saving"}
          className="inline-flex h-8 items-center rounded-md px-2.5 text-[12px] font-medium text-fg-muted transition-colors hover:bg-muted hover:text-fg disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={status === "saving"}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-btn px-3 text-[12px] font-medium text-btn-fg transition-[filter] hover:brightness-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]"
        >
          {status === "saving" ? <Spinner /> : <Check size={13} strokeWidth={2.2} />}
          {status === "error" ? "Retry" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
