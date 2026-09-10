import { NextRequest, NextResponse } from "next/server";
import { scanSentForLeads } from "@/lib/google/lead-scan";
import {
  createContact,
  dismissLeadEmails,
  ensureLeadDeal,
  quickAddPerson,
} from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

// Scanning Sent mail fans out to Gmail per-message; give it room under the cron-class limit.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** GET — scan Sent mail for people not yet in the CRM. */
export async function GET(req: NextRequest) {
  try {
    const limit = rateLimit(`leads:${clientIp(req)}`, 20, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many scans. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }
    return NextResponse.json(await scanSentForLeads());
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST — add a candidate as a lead, or dismiss it from the queue. */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`leads:${clientIp(req)}`, 60, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }
    const body = await readJson(req);
    const action = body.action;

    if (action === "dismiss") {
      const list = Array.isArray(body.emails)
        ? body.emails
        : typeof body.email === "string"
          ? [body.email]
          : [];
      const emails = list.map((e: unknown) => String(e || "").trim()).filter(Boolean);
      if (emails.length === 0) {
        return NextResponse.json({ error: "No email to dismiss." }, { status: 400 });
      }
      await dismissLeadEmails(emails);
      return NextResponse.json({ ok: true });
    }

    if (action === "add") {
      const email = String(body.email || "").trim();
      const name = String(body.name || "").trim();
      const linkCompanyId = String(body.companyId || "").trim();
      const companyName = String(body.company || body.companyName || "").trim();
      // "lead" (default) → Prospect + a pipeline deal; "customer" → a customer
      // contact, no deal. When linking to an existing company, an omitted `as`
      // lets the person inherit that account's lifecycle.
      const as = body.as === "customer" ? "customer" : body.as === "lead" ? "lead" : null;
      if (!email) {
        return NextResponse.json({ error: "An email address is required." }, { status: 400 });
      }

      let contactId: string | undefined;
      let companyId: string | undefined;

      if (linkCompanyId) {
        // Link to an existing account — inherit its lifecycle unless one was chosen.
        const contact = await createContact({
          name: name || email,
          email,
          companyId: linkCompanyId,
          source: "Gmail",
          ...(as ? { status: as === "customer" ? "Customer" : "Lead" } : {}),
        });
        contactId = contact.id;
        companyId = linkCompanyId;
        if (as === "lead") {
          await ensureLeadDeal({ name: name || email, companyId, contactId }).catch(() => {});
        }
      } else if (companyName) {
        // New company by name → company + contact (+ pipeline deal only for a lead).
        const r = await quickAddPerson({
          name: name || undefined,
          email,
          companyName,
          lifecycleStage: as === "customer" ? "Customer" : "Prospect",
          source: "Gmail",
          contactStatus: as === "customer" ? "Customer" : "Lead",
        });
        companyId = r.company.id;
        contactId = r.contact?.id;
      } else {
        // Free mailbox, no company → company-less contact (+ deal only for a lead).
        const contact = await createContact({
          name: name || email,
          email,
          status: as === "customer" ? "Customer" : "Lead",
          source: "Gmail",
        });
        contactId = contact.id;
        if (as !== "customer") {
          await ensureLeadDeal({ name: name || email, contactId }).catch(() => {});
        }
      }

      // Once added, drop it from the queue so it doesn't resurface on the next scan.
      await dismissLeadEmails([email]);
      return NextResponse.json({ ok: true, contactId, companyId });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
