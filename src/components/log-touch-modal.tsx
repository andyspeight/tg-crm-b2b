"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { TOUCH_TYPES } from "@/lib/crm/config";
import { Button, Field, InlineAlert, Modal, Select, Textarea } from "@/components/ui";

/**
 * One shared "log a care touch" dialog, used from the Care board and the Today
 * screen. Completes the given touch and schedules the next per cadence.
 */
export function LogTouchModal({
  open,
  onClose,
  touchId,
  companyName,
  defaultTouchType,
  cadence,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  touchId?: string;
  companyName?: string;
  defaultTouchType?: string;
  cadence?: string;
  onLogged: () => void;
}) {
  const [touchType, setTouchType] = useState(defaultTouchType || "Check-In Call");
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTouchType(defaultTouchType || "Check-In Call");
      setOutcome("");
      setError("");
      setSaving(false);
    }
  }, [open, defaultTouchType]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!touchId) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/care/log", {
        method: "POST",
        body: JSON.stringify({ touchId, touchType, outcomeNotes: outcome }),
      });
      onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log touch");
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={companyName ? `Log touch · ${companyName}` : "Log touch"}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-[13px] text-fg-muted">
          Marks this touch done
          {cadence && cadence !== "None"
            ? ` and schedules the next one per the ${cadence.toLowerCase()} cadence`
            : " and schedules the next one per cadence"}
          .
        </p>
        <Field label="Touch type">
          <Select value={touchType} onChange={(e) => setTouchType(e.target.value)}>
            {TOUCH_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Outcome notes">
          <Textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            autoFocus
            placeholder="How did it go? Anything to follow up?"
          />
        </Field>
        {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !touchId}>
            {saving ? "Saving…" : "Log and reschedule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
