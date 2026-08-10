"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Reply } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Modal, Spinner, cn } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { Activity, Contact } from "@/lib/crm/types";

type Payload = { contact: Contact; emails: Activity[] };

/** Strip the "Received from…/Sent to…" header line the sync prepends to the body. */
function bodyText(raw?: string): string {
  if (!raw) return "";
  const body = raw.replace(/^(Received from|Sent to)[^\n]*\n+/i, "");
  return body.trim();
}

/** A person's email correspondence — reachable for contacts with no company page. */
export function ContactEmailsDrawer({
  contactId,
  highlightMessageId,
  onClose,
  onReply,
}: {
  contactId: string | null;
  highlightMessageId?: string;
  onClose: () => void;
  onReply: (contact: Contact) => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!contactId) return;
    setData(null);
    setError("");
    api<Payload>(`/api/contacts/${contactId}/emails`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load emails"));
  }, [contactId]);

  if (!contactId) return null;
  const contact = data?.contact;

  return (
    <Modal open onClose={onClose} title={contact?.name || "Emails"}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 text-[13px] text-fg-subtle">
            {contact?.email ? <span className="text-fg">{contact.email}</span> : null}
            {contact?.companyName ? (
              <>
                {" · "}
                {contact.companyId ? (
                  <Link href={`/companies/${contact.companyId}`} className="hover:text-accent-strong">
                    {contact.companyName}
                  </Link>
                ) : (
                  contact.companyName
                )}
              </>
            ) : null}
          </div>
          {contact ? (
            <Button size="sm" onClick={() => onReply(contact)}>
              <Reply size={15} strokeWidth={1.9} /> Reply
            </Button>
          ) : null}
        </div>

        {error ? (
          <p className="text-[13px] text-danger">{error}</p>
        ) : !data ? (
          <div className="flex items-center gap-2 py-6 text-[13px] text-fg-subtle">
            <Spinner /> Loading emails…
          </div>
        ) : data.emails.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-fg-subtle">No emails on file for this person yet.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {data.emails.map((e) => {
              const inbound = e.direction === "Inbound";
              const highlight = !!highlightMessageId && e.gmailMessageId === highlightMessageId;
              return (
                <li
                  key={e.id}
                  className={cn(
                    "rounded-xl border p-3",
                    highlight ? "border-accent ring-1 ring-accent" : "border-border-soft bg-surface",
                  )}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                        inbound ? "bg-accent/10 text-accent-strong" : "bg-muted text-fg-muted",
                      )}
                    >
                      {inbound ? (
                        <ArrowDownLeft size={12} strokeWidth={2} />
                      ) : (
                        <ArrowUpRight size={12} strokeWidth={2} />
                      )}
                      {inbound ? "Received" : "Sent"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
                      {e.summary || "(no subject)"}
                    </span>
                    <span className="tnum shrink-0 text-[11.5px] text-fg-subtle">
                      {formatDateTime(e.date || e.createdTime)}
                    </span>
                  </div>
                  {bodyText(e.rawContent) ? (
                    <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg-muted line-clamp-6">
                      {bodyText(e.rawContent)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
