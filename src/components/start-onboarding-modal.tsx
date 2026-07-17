"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Rocket } from "lucide-react";
import { api } from "@/lib/client";
import { PACKAGES } from "@/lib/crm/config";
import { Button, Field, InlineAlert, Input, Modal, Select, Spinner } from "@/components/ui";

type ContactOption = { id: string; name: string; email?: string };

/** The URL of the onboarding tool (public — used to link to the created client). */
const ONBOARDING_URL = process.env.NEXT_PUBLIC_ONBOARDING_URL;

export function StartOnboardingModal({
  open,
  onClose,
  company,
  contacts,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  company: { id: string; name: string; planTier?: string };
  contacts: ContactOption[];
  onStarted: () => void | Promise<void>;
}) {
  const withEmail = contacts.filter((c) => c.email);
  const [contactId, setContactId] = useState("");
  const [plan, setPlan] = useState("");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    if (open) {
      setContactId(withEmail[0]?.id ?? "");
      setPlan(company.planTier && (PACKAGES as readonly string[]).includes(company.planTier) ? company.planTier : "");
      setStartDate(new Date().toISOString().slice(0, 10));
      setError("");
      setSaving(false);
      setClientId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function start() {
    if (!contactId) return setError("Pick the contact to onboard (they need an email).");
    if (!plan) return setError("Choose a package.");
    setSaving(true);
    setError("");
    try {
      const data = await api<{ clientId: string }>("/api/onboarding/handoff", {
        method: "POST",
        body: JSON.stringify({ companyId: company.id, contactId, plan, startDate }),
      });
      setClientId(data.clientId);
      await onStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start onboarding");
    } finally {
      setSaving(false);
    }
  }

  if (clientId) {
    const link = ONBOARDING_URL ? `${ONBOARDING_URL.replace(/\/+$/, "")}/admin/clients/${clientId}` : null;
    return (
      <Modal open={open} onClose={onClose} title="Onboarding started">
        <div className="flex flex-col items-center py-5 text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-success/12 text-success">
            <CheckCircle2 size={26} strokeWidth={1.9} />
          </span>
          <p className="text-[15px] font-medium text-fg">{company.name} is now onboarding</p>
          <p className="mt-1 max-w-sm text-[13px] text-fg-subtle">
            Their journey is set up in the onboarding tool, and this account is now a Customer.
          </p>
          {link ? (
            <a href={link} target="_blank" rel="noreferrer" className="mt-4">
              <Button>
                <ExternalLink size={15} strokeWidth={1.75} /> Open in onboarding
              </Button>
            </a>
          ) : null}
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Start onboarding · ${company.name}`}>
      <div className="space-y-4">
        <p className="text-[13px] text-fg-subtle">
          This creates the client in the onboarding tool, kicks off their journey, and marks this account
          a Customer.
        </p>

        {withEmail.length === 0 ? (
          <InlineAlert variant="danger">
            Add a contact with an email address first — that&apos;s who the onboarding portal is for.
          </InlineAlert>
        ) : (
          <Field label="Contact to onboard">
            <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              {withEmail.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.email}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Package">
            <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="">Select a package</option>
              {PACKAGES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </div>

        {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={start} disabled={saving || withEmail.length === 0}>
            {saving ? <Spinner /> : <Rocket size={15} strokeWidth={1.75} />} Start onboarding
          </Button>
        </div>
      </div>
    </Modal>
  );
}
