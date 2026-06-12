"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, RefreshCw, Table2 } from "lucide-react";
import { api } from "@/lib/client";
import type { BoardPreview, MondayBoard } from "@/lib/monday/types";
import { Button, Modal, Spinner } from "@/components/ui";

export function MondayImport() {
  const [boards, setBoards] = useState<MondayBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [previewing, setPreviewing] = useState<MondayBoard | null>(null);
  const [preview, setPreview] = useState<BoardPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

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

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg">Import from Monday</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-fg-muted">
            These are the boards Luna Desk can see in your Monday account. Nothing is written —
            use <strong>Preview</strong> on a board to sample its rows and see the actual values in
            each column, so the import maps onto Luna Desk correctly.
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
            If you have just added the token in Vercel, give the deploy a minute to go live, then hit
            Refresh.
          </p>
        </div>
      ) : boards.length === 0 ? (
        <p className="text-[13px] text-fg-subtle">No boards found on this Monday account.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-fg-subtle">
            {boards.length} board{boards.length === 1 ? "" : "s"} found
          </p>
          {boards.map((b) => (
            <div key={b.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Building2 size={15} strokeWidth={1.75} className="shrink-0 text-fg-subtle" />
                  <h2 className="truncate text-[14px] font-semibold text-fg">{b.name}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tnum text-[12px] text-fg-subtle">
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
          ))}
        </div>
      )}

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
                        {col.values.map((v) => (
                          <span
                            key={v.value}
                            className="inline-flex items-center gap-1 rounded-md border border-border-soft bg-surface px-2 py-0.5 text-[11px] text-fg-muted"
                          >
                            {v.value}
                            <span className="tnum text-fg-subtle">× {v.count}</span>
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
    </div>
  );
}
