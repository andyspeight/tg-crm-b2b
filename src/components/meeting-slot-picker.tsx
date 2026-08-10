"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Button, Modal, Select, Spinner, cn } from "@/components/ui";
import { meetingButtonHtml, slotBookingLink } from "@/lib/meetings";
import type { MeetingConfig, MeetingOption } from "@/lib/crm/types";

type Availability = { timezone: string; connected: boolean; slots: { startISO: string }[] };

function fmt(iso: string, tz: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-GB", opts).format(new Date(iso));
  }
}

/**
 * "Send time options": pick specific slots from the scheduler's live availability
 * and insert them into the email as one-click booking links. Mirrors the
 * appointment-share page, but in-composer.
 */
export function MeetingSlotPicker({
  config,
  onInsert,
  onClose,
}: {
  config: MeetingConfig;
  onInsert: (html: string) => void;
  onClose: () => void;
}) {
  const [optionId, setOptionId] = useState(config.options[0]?.id ?? "");
  const option: MeetingOption | undefined = config.options.find((o) => o.id === optionId);
  const [data, setData] = useState<Availability | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!option) return;
    setData(null);
    setError("");
    setSelected([]);
    setLoading(true);
    api<Availability>(`/api/meetings/availability?eventId=${encodeURIComponent(option.eventId)}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load availability"))
      .finally(() => setLoading(false));
  }, [option?.eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const tz = data?.timezone || "Europe/London";
  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of data?.slots ?? []) {
      const day = fmt(s.startISO, tz, { weekday: "short", day: "numeric", month: "short" });
      (map.get(day) ?? map.set(day, []).get(day)!).push(s.startISO);
    }
    return [...map.entries()];
  }, [data, tz]);

  function toggle(iso: string) {
    setSelected((xs) => (xs.includes(iso) ? xs.filter((x) => x !== iso) : [...xs, iso].sort()));
  }

  function insert() {
    if (!option || selected.length === 0) return;
    const buttons = selected
      .map((iso) => {
        const label = `${fmt(iso, tz, { weekday: "short", day: "numeric", month: "short" })} · ${fmt(iso, tz, { hour: "numeric", minute: "2-digit" })}`;
        return `<span style="display:inline-block;margin:0 6px 6px 0">${meetingButtonHtml(label, slotBookingLink(config, option, iso, selected))}</span>`;
      })
      .join("");
    const html =
      `<p>Here are a few times that suit — click one to book${option.mins ? ` (${option.mins} min)` : ""}:</p>` +
      `<p>${buttons}</p>`;
    onInsert(html);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Send time options">
      <div className="space-y-4">
        {config.options.length > 1 ? (
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-fg-muted">Meeting</span>
            <Select value={optionId} onChange={(e) => setOptionId(e.target.value)} className="h-9 w-56 text-[13px]">
              {config.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                  {o.mins ? ` (${o.mins} min)` : ""}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-[13px] text-fg-subtle">
            <Spinner /> Loading availability…
          </div>
        ) : error ? (
          <p className="py-6 text-[13px] text-danger">{error}</p>
        ) : byDay.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-fg-subtle">
            No available times in the next two weeks. Check the scheduler&apos;s availability and connected calendar.
          </p>
        ) : (
          <>
            <p className="text-[12px] text-fg-subtle">
              Times shown in {tz.replace(/_/g, " ")}
              {data && !data.connected ? " · calendar not connected — these are the scheduler's set hours" : ""}
            </p>
            <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
              {byDay.map(([day, isos]) => (
                <div key={day}>
                  <p className="mb-1.5 text-[12px] font-semibold text-fg-subtle">{day}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {isos.map((iso) => {
                      const on = selected.includes(iso);
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => toggle(iso)}
                          className={cn(
                            "tnum rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors",
                            on
                              ? "border-accent bg-accent text-white"
                              : "border-border-soft bg-surface text-fg hover:border-border",
                          )}
                        >
                          {fmt(iso, tz, { hour: "numeric", minute: "2-digit" })}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border-soft pt-3">
          <span className="text-[12.5px] text-fg-subtle">
            {selected.length} time{selected.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={insert} disabled={selected.length === 0}>
              Insert {selected.length || ""} time{selected.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
