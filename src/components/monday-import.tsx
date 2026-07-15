"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Download, RefreshCw, Table2 } from "lucide-react";
import { api } from "@/lib/client";
import type { BoardPreview, MondayBoard } from "@/lib/monday/types";
import { Button, Modal, Spinner } from "@/components/ui";

/** Board names Luna Desk knows how to import, and the Luna object they map to. */
function inferTarget(
  name: string,
): "companies" | "contacts" | "deals" | "leads" | "clientsprogress" | null {
  const n = name.toLowerCase().trim();
  if (n === "companies") return "companies";
  if (n === "contacts" || n === "contacts type") return "contacts";
  if (n === "deals") return "deals";
  if (n === "leads") return "leads";
  if (n === "clients progress") return "clientsprogress";
  return null;
}

const NOUNS: Record<string, [string, string]> = {
  contacts: ["contact", "contacts"],
  deals: ["deal", "deals"],
  leads: ["lead", "leads"],
  companies: ["company", "companies"],
};
const nounFor = (target: string, n: number) => (NOUNS[target] ?? NOUNS.companies)[n === 1 ? 0 : 1];

type PlanResult = {
  target: string;
  total: number;
  willCreate: number;
  duplicates: number;
  skipped: number;
  companies?: number;
  sample: { primary: string; detail: string }[];
};
type CommitResult = {
  target: string;
  created: number;
  duplicates: number;
  skipped: number;
  companies?: number;
};

export function MondayImport() {
  const router = useRouter();
  const [boards, setBoards] = useState<MondayBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [previewing, setPreviewing] = useState<MondayBoard | null>(null);
  const [preview, setPreview] = useState<BoardPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [importing, setImporting] = useState<MondayBoard | null>(null);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [commitError, setCommitError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ boards: MondayBoard[] }>("/api/import/monday/boards");
      setBoards(data.boards);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read your Monday boards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openPreview(board: MondayBoard) {
    setPreviewing(board);
    setPreview(null);
    setPreviewError("");
    setPreviewLoading(true);
    try {
      const data = await api<BoardPreview>("/api/import/monday/preview", {
        method: "POST",
        body: JSON.stringify({ boardId: board.id }),
      });
      setPreview(data);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Could not read that board");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function openImport(board: MondayBoard) {
    setImporting(board);
    setPlan(null);
    setPlanError("");
    setCommitResult(null);
    setCommitError("");
    setPlanLoading(true);
    try {
      const data = await api<PlanResult>("/api/import/monday/plan", {
        method: "POST",
        body: JSON.stringify({ boardId: board.id, target: inferTarget(board.name) }),
      });
      setPlan(data);
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Could not prepare the import");
    } finally {
      setPlanLoading(false);
    }
  }

  async function runCommit() {
    if (!importing) return;
    setCommitting(true);
    setCommitError("");
    try {
      const data = await api<CommitResult>("/api/import/monday/commit", {
        method: "POST",
        body: JSON.stringify({ boardId: importing.id, target: inferTarget(importing.name) }),
      });
      setCommitResult(data);
    } catch (e) {
      setCommitError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg">Import from Monday</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-fg-muted">
            <strong>Preview</strong> samples a board's rows (writes nothing).{" "}
            <strong>Import</strong> shows you a count and only writes when you confirm. Companies is
            ready first; the other boards follow.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          {loading ? <Spinner /> : <RefreshCw size={14} strokeWidth={1.75} />} Refresh
        </Button>
      </header>

      {loading ? (
        <p className="flex items-center gap-2 text-[13px] text-fg-subtle">
          <Spinner /> Reading your Monday boards...
        </p>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[13px] font-medium text-danger">{error}</p>
          <p className="mt-1.5 text-[12px] text-fg-muted">
            If you have just added the token in Vercel, give the deploy a minute, then hit Refresh.
          </p>
        </div>
      ) : boards.length === 0 ? (
        <p className="text-[13px] text-fg-subtle">No boards found on this Monday account.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-fg-subtle">
            {boards.length} board{boards.length === 1 ? "" : "s"} found
          </p>
          {boards.map((b) => {
            const target = inferTarget(b.name);
            return (
              <div key={b.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Building2 size={15} strokeWidth={1.75} className="shrink-0 text-fg-subtle" />
                    <h2 className="truncate text-[14px] font-semibold text-fg">{b.name}</h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tnum mr-1 text-[12px] text-fg-subtle">
                      {b.itemsCount ?? "?"} item{b.itemsCount === 1 ? "" : "s"}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openPreview(b)}
                      disabled={!b.itemsCount}
                    >
                      <Table2 size={14} strokeWidth={1.75} /> Preview
                    </Button>
                    {target && b.itemsCount ? (
                      <Button size="sm" onClick={() => openImport(b)}>
                        <Download size={14} strokeWidth={1.9} /> Import
                      </Button>
                    ) : null}
                  </div>
                </div>
                {b.columns.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {b.columns.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 rounded-md border border-border-soft bg-surface px-2 py-0.5 text-[11px] text-fg-muted"
                      >
                        {c.title}
                        <span className="text-fg-subtle">· {c.type}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Preview (read-only) */}
      <Modal
        open={!!previewing}
        onClose={() => setPreviewing(null)}
        title={previewing ? `Preview: ${previewing.name}` : "Preview"}
      >
        {previewLoading ? (
          <p className="flex items-center gap-2 text-[13px] text-fg-subtle">
            <Spinner /> Reading rows from Monday...
          </p>
        ) : previewError ? (
          <p className="text-[13px] text-danger">{previewError}</p>
        ) : preview ? (
          <div className="space-y-5">
            <p className="text-[13px] text-fg-muted">
              Read <strong className="text-fg">{preview.itemCount}</strong> rows
              {preview.capped ? " (sampled the first 1,500)" : ""}. Nothing has been written.
            </p>

            {preview.breakdown.length > 0 ? (
              <div>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-fg-subtle">
                  Column values
                </h3>
                <div className="space-y-2.5">
                  {preview.breakdown.map((col) => (
                    <div key={col.title}>
                      <p className="text-[12px] font-medium text-fg">{col.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {col.values.map((val) => (
                          <span
                            key={val.value}
                            className="inline-flex items-center gap-1 rounded-md border border-border-soft bg-surface px-2 py-0.5 text-[11px] text-fg-muted"
                          >
                            {val.value}
                            <span className="tnum text-fg-subtle">× {val.count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {preview.sample.length > 0 ? (
              <div>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-fg-subtle">
                  Sample rows
                </h3>
                <div className="space-y-2">
                  {preview.sample.map((row) => (
                    <div key={row.id} className="rounded-lg border border-border-soft bg-surface p-2.5">
                      <p className="text-[13px] font-medium text-fg">{row.name || "(no name)"}</p>
                      {row.cells.length > 0 ? (
                        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                          {row.cells.map((cell) => (
                            <div key={cell.title} className="contents">
                              <dt className="text-[11px] text-fg-subtle">{cell.title}</dt>
                              <dd className="truncate text-[11px] text-fg-muted">{cell.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Import (confirm before write) */}
      <Modal
        open={!!importing}
        onClose={() => setImporting(null)}
        title={importing ? `Import: ${importing.name}` : "Import"}
      >
        {planLoading ? (
          <p className="flex items-center gap-2 text-[13px] text-fg-subtle">
            <Spinner /> Preparing the import...
          </p>
        ) : planError ? (
          <p className="text-[13px] text-danger">{planError}</p>
        ) : commitResult ? (
          <div className="space-y-4">
            <p className="text-[14px] text-fg">
              {commitResult.target === "clientsprogress" ? (
                <>
                  Set health on <strong>{commitResult.created}</strong>{" "}
                  {commitResult.created === 1 ? "customer" : "customers"}
                  {commitResult.companies
                    ? ` and created ${commitResult.companies} new ${commitResult.companies === 1 ? "customer" : "customers"}`
                    : ""}
                  .
                </>
              ) : (
                <>
                  Imported <strong>{commitResult.created}</strong>{" "}
                  {nounFor(commitResult.target, commitResult.created)}
                  {commitResult.companies
                    ? ` and ${commitResult.companies} prospect ${commitResult.companies === 1 ? "company" : "companies"}`
                    : ""}
                  .
                </>
              )}
            </p>
            <p className="text-[13px] text-fg-muted">
              {commitResult.target === "clientsprogress"
                ? `${commitResult.skipped} had no mappable status.`
                : `${commitResult.duplicates} already in Luna Desk (skipped); ${commitResult.skipped} had no name.`}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setImporting(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setImporting(null);
                  router.push("/companies");
                  router.refresh();
                }}
              >
                View companies
              </Button>
            </div>
          </div>
        ) : plan ? (
          <div className="space-y-4">
            <p className="text-[14px] text-fg">
              {plan.target === "clientsprogress" ? (
                <>
                  <strong>{plan.willCreate}</strong> existing{" "}
                  {plan.willCreate === 1 ? "customer" : "customers"} will have their health updated
                  {plan.companies ? (
                    <>
                      , and <strong>{plan.companies}</strong> new{" "}
                      {plan.companies === 1 ? "customer" : "customers"} will be created
                    </>
                  ) : null}
                  .
                </>
              ) : (
                <>
                  <strong>{plan.willCreate}</strong> new {nounFor(plan.target, plan.willCreate)} will
                  be created
                  {plan.target === "companies"
                    ? " as customers (Green health, quarterly care)"
                    : plan.target === "contacts"
                      ? ", linked to their company where the name matches"
                      : plan.target === "deals"
                        ? ", mapped onto your pipeline stages"
                        : plan.target === "leads"
                          ? " as prospect contacts"
                          : ""}
                  .
                </>
              )}
            </p>
            {plan.companies && plan.target !== "clientsprogress" ? (
              <p className="text-[13px] text-fg-muted">
                Plus <strong className="text-fg">{plan.companies}</strong> new prospect{" "}
                {plan.companies === 1 ? "company" : "companies"}.
              </p>
            ) : null}
            <p className="text-[13px] text-fg-muted">
              {plan.target === "clientsprogress"
                ? `From ${plan.total} onboarding rows${plan.skipped ? `, ${plan.skipped} had no mappable status` : ""}.`
                : `From ${plan.total} rows: ${plan.duplicates} already in Luna Desk (skipped), ${plan.skipped} had no name.`}
            </p>

            {plan.sample.length > 0 ? (
              <div>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-fg-subtle">
                  First few
                </h3>
                <div className="space-y-1.5">
                  {plan.sample.map((c, i) => (
                    <div
                      key={`${c.primary}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border-soft bg-surface px-2.5 py-1.5"
                    >
                      <span className="truncate text-[13px] text-fg">{c.primary}</span>
                      <span className="shrink-0 text-[11px] text-fg-subtle">{c.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {commitError ? <p className="text-[13px] text-danger">{commitError}</p> : null}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setImporting(null)} disabled={committing}>
                Cancel
              </Button>
              <Button
                onClick={runCommit}
                disabled={committing || (plan.willCreate === 0 && !plan.companies)}
              >
                {committing ? <Spinner /> : <Download size={15} strokeWidth={1.9} />}{" "}
                {plan.target === "clientsprogress"
                  ? `Apply to ${plan.willCreate + (plan.companies ?? 0)} ${
                      plan.willCreate + (plan.companies ?? 0) === 1 ? "customer" : "customers"
                    }`
                  : `Import ${plan.willCreate} ${nounFor(plan.target, plan.willCreate)}`}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
