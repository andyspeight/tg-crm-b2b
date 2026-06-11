"use client";

import { useState } from "react";
import {
  ACCOUNT_HEALTH,
  CARE_CADENCES,
  COMPANY_TYPES,
  DEAL_SOURCES,
  DEAL_STAGES,
  LIFECYCLE_STAGES,
  MARKETING_OPT_IN,
  REGIONS,
  SIZE_BANDS,
} from "@/lib/crm/config";
import type { Company, Contact, Deal } from "@/lib/crm/types";
import { Button, ErrorText, Field, Input, Select, Textarea } from "@/components/ui";

export type CompanyOption = { id: string; name: string };

function blankOption(label = "—") {
  return (
    <option value="">{label}</option>
  );
}

function options(values: readonly string[]) {
  return values.map((v) => (
    <option key={v} value={v}>
      {v}
    </option>
  ));
}

function FormShell({
  children,
  onSubmit,
  onCancel,
  submitLabel,
  error,
  saving,
}: {
  children: React.ReactNode;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  error: string;
  saving: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      {children}
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// --- Company ----------------------------------------------------------------

export function CompanyForm({
  initial,
  onSave,
  onCancel,
  submitLabel = "Save",
}: {
  initial?: Partial<Company>;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    website: initial?.website ?? "",
    type: initial?.type ?? "",
    country: initial?.country ?? "",
    region: initial?.region ?? "",
    linkedin: initial?.linkedin ?? "",
    lifecycleStage: initial?.lifecycleStage ?? "",
    accountHealth: initial?.accountHealth ?? "",
    careCadence: initial?.careCadence ?? "",
    planTier: initial?.planTier ?? "",
    mrr: initial?.mrr != null ? String(initial.mrr) : "",
    sizeBand: initial?.sizeBand ?? "",
    goLiveDate: initial?.goLiveDate ?? "",
    renewalDate: initial?.renewalDate ?? "",
    description: initial?.description ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!f.name.trim()) {
      setError("Company name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <FormShell
      onSubmit={submit}
      onCancel={onCancel}
      submitLabel={submitLabel}
      error={error}
      saving={saving}
    >
      <Field label="Company name">
        <Input value={f.name} onChange={set("name")} autoFocus placeholder="Coastline Travel Group" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select value={f.type} onChange={set("type")}>
            {blankOption()}
            {options(COMPANY_TYPES)}
          </Select>
        </Field>
        <Field label="Lifecycle stage">
          <Select value={f.lifecycleStage} onChange={set("lifecycleStage")}>
            {blankOption()}
            {options(LIFECYCLE_STAGES)}
          </Select>
        </Field>
        <Field label="Country">
          <Input value={f.country} onChange={set("country")} placeholder="United Kingdom" />
        </Field>
        <Field label="Region">
          <Select value={f.region} onChange={set("region")}>
            {blankOption()}
            {options(REGIONS)}
          </Select>
        </Field>
        <Field label="Website">
          <Input value={f.website} onChange={set("website")} placeholder="https://" />
        </Field>
        <Field label="LinkedIn URL">
          <Input value={f.linkedin} onChange={set("linkedin")} placeholder="https://linkedin.com/company/" />
        </Field>
      </div>

      <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Customer details
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account health">
          <Select value={f.accountHealth} onChange={set("accountHealth")}>
            {blankOption()}
            {options(ACCOUNT_HEALTH)}
          </Select>
        </Field>
        <Field label="Care cadence">
          <Select value={f.careCadence} onChange={set("careCadence")}>
            {blankOption()}
            {options(CARE_CADENCES)}
          </Select>
        </Field>
        <Field label="Plan / tier">
          <Input value={f.planTier} onChange={set("planTier")} />
        </Field>
        <Field label="MRR (£)">
          <Input value={f.mrr} onChange={set("mrr")} inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Go-live date">
          <Input type="date" value={f.goLiveDate} onChange={set("goLiveDate")} />
        </Field>
        <Field label="Renewal date">
          <Input type="date" value={f.renewalDate} onChange={set("renewalDate")} />
        </Field>
        <Field label="Size band">
          <Select value={f.sizeBand} onChange={set("sizeBand")}>
            {blankOption()}
            {options(SIZE_BANDS)}
          </Select>
        </Field>
      </div>
      <Field label="Description">
        <Textarea value={f.description} onChange={set("description")} />
      </Field>
    </FormShell>
  );
}

// --- Contact ----------------------------------------------------------------

export function ContactForm({
  initial,
  companies,
  lockedCompanyId,
  onSave,
  onCancel,
  submitLabel = "Save",
}: {
  initial?: Partial<Contact>;
  companies?: CompanyOption[];
  lockedCompanyId?: string;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    role: initial?.role ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    linkedin: initial?.linkedin ?? "",
    marketingOptIn: initial?.marketingOptIn ?? "",
    companyId: lockedCompanyId ?? initial?.companyId ?? "",
    headline: initial?.headline ?? "",
    location: initial?.location ?? "",
    notes: initial?.notes ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!f.name.trim()) {
      setError("Contact name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <FormShell
      onSubmit={submit}
      onCancel={onCancel}
      submitLabel={submitLabel}
      error={error}
      saving={saving}
    >
      <Field label="Name">
        <Input value={f.name} onChange={set("name")} autoFocus placeholder="Priya Nair" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <Input value={f.role} onChange={set("role")} placeholder="Operations Manager" />
        </Field>
        {!lockedCompanyId && (
          <Field label="Company">
            <Select value={f.companyId} onChange={set("companyId")}>
              {blankOption("No company")}
              {(companies || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Email">
          <Input type="email" value={f.email} onChange={set("email")} />
        </Field>
        <Field label="Phone">
          <Input value={f.phone} onChange={set("phone")} />
        </Field>
        <Field label="LinkedIn URL">
          <Input value={f.linkedin} onChange={set("linkedin")} placeholder="https://linkedin.com/in/" />
        </Field>
        <Field label="Marketing opt-in">
          <Select value={f.marketingOptIn} onChange={set("marketingOptIn")}>
            {blankOption()}
            {options(MARKETING_OPT_IN)}
          </Select>
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={f.notes} onChange={set("notes")} />
      </Field>
    </FormShell>
  );
}

// --- Deal -------------------------------------------------------------------

export function DealForm({
  initial,
  companies,
  lockedCompanyId,
  onSave,
  onCancel,
  submitLabel = "Save",
}: {
  initial?: Partial<Deal>;
  companies?: CompanyOption[];
  lockedCompanyId?: string;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    stage: initial?.stage ?? "New Lead",
    companyId: lockedCompanyId ?? initial?.companyId ?? "",
    mrr: initial?.mrr != null ? String(initial.mrr) : "",
    setupFee: initial?.setupFee != null ? String(initial.setupFee) : "",
    source: initial?.source ?? "",
    expectedCloseDate: initial?.expectedCloseDate ?? "",
    owner: initial?.owner ?? "",
    nextStep: initial?.nextStep ?? "",
    nextStepDate: initial?.nextStepDate ?? "",
    lostReason: initial?.lostReason ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!f.name.trim()) {
      setError("Deal name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <FormShell
      onSubmit={submit}
      onCancel={onCancel}
      submitLabel={submitLabel}
      error={error}
      saving={saving}
    >
      <Field label="Deal name">
        <Input value={f.name} onChange={set("name")} autoFocus placeholder="Coastline Travel - platform switch" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stage">
          <Select value={f.stage} onChange={set("stage")}>
            {options(DEAL_STAGES)}
          </Select>
        </Field>
        {!lockedCompanyId && (
          <Field label="Company">
            <Select value={f.companyId} onChange={set("companyId")}>
              {blankOption("No company")}
              {(companies || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="MRR (£)">
          <Input value={f.mrr} onChange={set("mrr")} inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Setup fee (£)">
          <Input value={f.setupFee} onChange={set("setupFee")} inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Source">
          <Select value={f.source} onChange={set("source")}>
            {blankOption()}
            {options(DEAL_SOURCES)}
          </Select>
        </Field>
        <Field label="Expected close">
          <Input type="date" value={f.expectedCloseDate} onChange={set("expectedCloseDate")} />
        </Field>
        <Field label="Owner">
          <Input value={f.owner} onChange={set("owner")} />
        </Field>
        <Field label="Next step">
          <Input value={f.nextStep} onChange={set("nextStep")} />
        </Field>
        <Field label="Next step date">
          <Input type="date" value={f.nextStepDate} onChange={set("nextStepDate")} />
        </Field>
      </div>
      {f.stage === "Lost" && (
        <Field label="Lost reason">
          <Textarea value={f.lostReason} onChange={set("lostReason")} />
        </Field>
      )}
    </FormShell>
  );
}
