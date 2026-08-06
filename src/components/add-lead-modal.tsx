"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UserPlus } from "lucide-react";
import { api } from "@/lib/client";
import { PACKAGES } from "@/lib/crm/config";
import { Button, Field, InlineAlert, Input, Modal, Select, Spinner, cn } from "@/components/ui";

type Lifecycle = "Prospect" | "Customer";
const TABS: { value: Lifecycle; label: string }[] = [
  { value: "Prospect", label: "Lead" },
  { value: "Customer", label: "Customer" },
];

/**
 * The one form for adding a lead or a customer. Creates the person and their
 * company together — reusing the company if it already exists. Only the company
 * name is required (that's the account); the person and their contact details
 * are optional and tucked behind "Add detail" so a quick capture is two fields,
 * not five.
 */
export function AddLeadModal({
  open,
  mode,
  onClose,
}: {
  open: boolean;
  mode: Lifecycle;
  onClose: () => void;
}) {
  const router = useRouter();
  const [lifecycle, setLifecycle] = useState<Lifecycle>(mode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [pkg, setPkg] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setLifecycle(mode);
      setName("");
      setEmail("");
      setPhone("");
      setCompany("");
      setPkg("");
      setShowDetail(false);
      setError("");
      setSaving(false);
    }
  }, [open, mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return setError("Add the company name.");
    setSaving(true);
    setError("");
    try {
      const { company: created } = await api<{ company: { id: string } }>("/api/quick-add", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          phone,
          companyName: company,
          packageTier: pkg,
          lifecycleStage: lifecycle,
        }),
      });
      onClose();
      router.push(`/companies/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add lead or customer">
      <form onSubmit={submit} className="space-y-4">
        <div className="inline-flex rounded-lg border border-border p-0.5 text-[13px]">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setLifecycle(t.value)}
              className={cn(
                "rounded-md px-4 py-1.5 font-medium transition-colors",
                lifecycle === t.value ? "bg-muted text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Field label="Company name">
          <Input value={company} onChange={(e) => setCompany(e.target.value)} autoFocus placeholder="Coastline Travel Group" />
        </Field>
        <Field label="Full name" hint="Optional — the main contact, if you have one.">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Nair" />
        </Field>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            aria-expanded={showDetail}
            className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronDown size={15} strokeWidth={2} className={cn("transition-transform", showDetail && "rotate-180")} />
            {showDetail ? "Hide detail" : "Add detail"}
          </button>
          {showDetail ? (
            <div className="luna-fade space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Email">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@company.com" />
                </Field>
                <Field label="Phone">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44…" />
                </Field>
              </div>
              <Field label="Package">
                <Select value={pkg} onChange={(e) => setPkg(e.target.value)}>
                  <option value="">Select a package</option>
                  {PACKAGES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}
        </div>

        {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner /> : <UserPlus size={15} strokeWidth={1.75} />}
            {lifecycle === "Customer" ? " Add customer" : " Add lead"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
