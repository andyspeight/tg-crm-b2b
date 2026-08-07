"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { useConfirm, useToast } from "@/components/feedback";

type Ided = { id: string };

/**
 * The shared mechanics behind every directory list (Companies, People, …):
 * a debounced server search, and an optimistic delete with a 6-second undo
 * window before the row is actually removed. Extracted so the two lists behave
 * identically and the fiddly undo/pending bookkeeping lives in one place.
 *
 * Columns, filters and sorting stay in each view — this owns only the data
 * loading and mutation, not how rows look.
 */
export function useList<T extends Ided>(opts: {
  /** REST resource segment, e.g. "companies" — used for GET /api/{resource}?q= and DELETE /api/{resource}/{id}. */
  resource: string;
  /** Key the list arrives under in the JSON response, e.g. "companies". */
  responseKey: string;
  initial: T[];
  /** Lower-case noun ("company", "person") for messages; nounCap is its capitalised form. */
  noun: string;
  nounCap: string;
  nameOf: (item: T) => string;
  /** Body shown in the delete confirmation dialog. */
  deleteMessage: string;
}) {
  const [items, setItems] = useState<T[]>(opts.initial);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const first = useRef(true);
  const pending = useRef<Set<string>>(new Set());
  const toast = useToast();
  const confirm = useConfirm();

  async function refresh(term = q) {
    setLoading(true);
    try {
      const data = await api<Record<string, T[]>>(
        `/api/${opts.resource}${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`,
      );
      const list = (data[opts.responseKey] ?? []) as T[];
      // Keep optimistically-removed rows hidden until their deferred delete lands.
      setItems(list.filter((c) => !pending.current.has(c.id)));
    } finally {
      setLoading(false);
    }
  }

  // Debounced search — skip the first run so we keep the server-rendered initial.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => refresh(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function remove(item: T) {
    const name = opts.nameOf(item);
    const ok = await confirm({
      title: `Delete ${name || `this ${opts.noun}`}?`,
      message: opts.deleteMessage,
      confirmLabel: "Delete",
    });
    if (!ok) return;

    // Optimistic: hide it now, actually delete when the undo window closes.
    const idx = items.findIndex((x) => x.id === item.id);
    pending.current.add(item.id);
    setItems((xs) => xs.filter((x) => x.id !== item.id));

    let undone = false;
    toast.success(`${name || opts.nounCap} deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          pending.current.delete(item.id);
          setItems((xs) => {
            if (xs.some((x) => x.id === item.id)) return xs;
            const next = [...xs];
            next.splice(Math.min(idx, next.length), 0, item);
            return next;
          });
        },
      },
    });

    window.setTimeout(async () => {
      if (undone) return;
      try {
        await api(`/api/${opts.resource}/${item.id}`, { method: "DELETE" });
      } catch (e) {
        toast.error(`Couldn't delete ${name || opts.noun}`, { description: (e as Error).message });
        await refresh();
      } finally {
        pending.current.delete(item.id);
      }
    }, 6000);
  }

  return { items, setItems, q, setQ, loading, refresh, remove };
}
