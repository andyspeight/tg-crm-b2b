"use client";

import { useState } from "react";
import { CalendarClock, ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import type { MeetingConfig, MeetingOption } from "@/lib/crm/types";
import { bookingLink, normalizeHost } from "@/lib/meetings";
import { Button, Field, IconButton, InlineAlert, Input, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/feedback";

let seq = 0;
function newOption(): MeetingOption {
  return { id: `opt_new_${seq++}`, label: "", eventId: "", mins: undefined, description: "" };
}

export function MeetingsView({ initial }: { initial: MeetingConfig }) {
  const toast = useToast();
  const [host, setHost] = useState(initial.host);
  const [widgetId, setWidgetId] = useState(initial.widgetId);
  const [options, setOptions] = useState<MeetingOption[]>(
    initial.options.length ? initial.options : [newOption()],
  );
  const [saving, setSaving] = useState(false);

  function patch(id: string, p: Partial<MeetingOption>) {
    setOptions((os) => os.map((o) => (o.id === id ? { ...o, ...p } : o)));
  }

  async function save() {
    setSaving(true);
    try {
      const clean = options
        .map((o) => ({ ...o, label: o.label.trim(), eventId: o.eventId.trim() }))
        .filter((o) => o.label && o.eventId);
      const saved = await api<MeetingConfig>("/api/meetings", {
        method: "PUT",
        body: JSON.stringify({ host, widgetId: widgetId.trim(), options: clean }),
      });
      setHost(saved.host);
      setWidgetId(saved.widgetId);
      setOptions(saved.options.length ? saved.options : [newOption()]);
      toast.success("Meeting options saved");
    } catch (e) {
      toast.error("Couldn't save", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const preview: MeetingConfig = { host: normalizeHost(host), widgetId: widgetId.trim(), options };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Meeting links"
        description="Booking links for your Appointment Scheduler, ready to drop into any email."
        actions={
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner /> : <Save size={16} strokeWidth={1.9} />} Save
          </Button>
        }
      />

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock size={16} strokeWidth={1.9} className="text-accent-strong" />
          <h2 className="text-[14px] font-semibold text-fg">Your scheduler</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Scheduler host" hint="e.g. https://tg-widgets.vercel.app or your widgets.travelify.io domain">
            <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="https://tg-widgets.vercel.app" />
          </Field>
          <Field label="Widget ID" hint="The appointment widget's data-tg-id (from the widget editor)">
            <Input value={widgetId} onChange={(e) => setWidgetId(e.target.value)} placeholder="e.g. appt_abc123" />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-fg">Meeting options</h2>
          <Button variant="secondary" size="sm" onClick={() => setOptions((os) => [...os, newOption()])}>
            <Plus size={15} strokeWidth={2} /> Add option
          </Button>
        </div>
        <p className="mb-3 text-[12.5px] text-fg-subtle">
          Each option maps to an event type on your scheduler. The <strong>Event ID</strong> must match the
          event&apos;s id in the widget (e.g. <code>consult</code>, <code>demo</code>).
        </p>

        <ul className="space-y-3">
          {options.map((o) => {
            const link = bookingLink(preview, o);
            return (
              <li key={o.id} className="rounded-xl border border-border-soft bg-surface p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_88px_auto]">
                  <Field label="Label">
                    <Input value={o.label} onChange={(e) => patch(o.id, { label: e.target.value })} placeholder="15-min intro call" />
                  </Field>
                  <Field label="Event ID">
                    <Input value={o.eventId} onChange={(e) => patch(o.id, { eventId: e.target.value })} placeholder="consult" />
                  </Field>
                  <Field label="Mins">
                    <Input
                      inputMode="numeric"
                      value={o.mins != null ? String(o.mins) : ""}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        patch(o.id, { mins: Number.isFinite(n) ? n : undefined });
                      }}
                      placeholder="15"
                    />
                  </Field>
                  <div className="flex items-end pb-1">
                    <IconButton
                      label="Remove option"
                      onClick={() => setOptions((os) => (os.length > 1 ? os.filter((x) => x.id !== o.id) : os))}
                      className="hover:text-danger"
                    >
                      <Trash2 size={16} strokeWidth={1.75} />
                    </IconButton>
                  </div>
                </div>
                <Field label="Description (optional)">
                  <Input
                    value={o.description ?? ""}
                    onChange={(e) => patch(o.id, { description: e.target.value })}
                    placeholder="A quick chat to see if we're a fit"
                  />
                </Field>
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[12px] text-accent-strong hover:underline"
                  >
                    <ExternalLink size={12} strokeWidth={2} /> {link}
                  </a>
                ) : (
                  <p className="mt-1 text-[12px] text-fg-subtle">Set a Widget ID and Event ID to generate the link.</p>
                )}
              </li>
            );
          })}
        </ul>

        {!widgetId.trim() ? (
          <div className="mt-4">
            <InlineAlert variant="info">
              Add your Widget ID above to activate the links. You&apos;ll find it in the Appointment Scheduler
              widget editor (or ask whoever set up the scheduler).
            </InlineAlert>
          </div>
        ) : null}
      </section>
    </div>
  );
}
