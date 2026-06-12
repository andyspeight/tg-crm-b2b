"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, RefreshCw } from "lucide-react";
import { api } from "@/lib/client";
import type { MondayBoard } from "@/lib/monday/types";
import { Button, Spinner } from "@/components/ui";

export function MondayImport() {
  const [boards, setBoards] = useState<MondayBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg">Import from Monday</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-fg-muted">
            These are the boards Luna Desk can see in your Monday account. Nothing is written yet —
            this is just so we can map the right boards and columns across. Once you can see your
            boards here, tell me which one is your customers, which is prospects, and which is your
            pipeline.
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
                <span className="tnum shrink-0 text-[12px] text-fg-subtle">
                  {b.itemsCount ?? "?"} item{b.itemsCount === 1 ? "" : "s"}
                </span>
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
    </div>
  );
}
