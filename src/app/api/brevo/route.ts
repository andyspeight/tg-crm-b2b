import { NextRequest, NextResponse } from "next/server";
import { listContacts } from "@/lib/crm/data";
import type { Contact } from "@/lib/crm/types";
import {
  BrevoNotConfiguredError,
  brevoConfigured,
  ensureAttributes,
  importContacts,
  listBrevoLists,
  type BrevoContact,
} from "@/lib/brevo/client";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Segment = "all" | "customers" | "prospects" | "optedin";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const isCustomer = (c: Contact) => c.status === "Customer" || c.companyLifecycle === "Customer";

function inSegment(c: Contact, segment: Segment): boolean {
  switch (segment) {
    case "customers":
      return isCustomer(c);
    case "prospects":
      return !isCustomer(c);
    case "optedin":
      return c.marketingOptIn === "Opted In";
    default:
      return true;
  }
}

function toBrevo(c: Contact): BrevoContact {
  const parts = (c.name || "").trim().split(/\s+/);
  const firstname = parts.shift() ?? "";
  return {
    email: (c.email || "").trim().toLowerCase(),
    attributes: {
      FIRSTNAME: firstname,
      LASTNAME: parts.join(" "),
      COMPANY: c.companyName ?? "",
      LIFECYCLE: c.status || c.companyLifecycle || "",
      OPTIN: c.marketingOptIn ?? "Unknown",
      SOURCE: c.source ?? "",
    },
  };
}

/** GET — connection status, the account's lists, and how many contacts each segment holds. */
export async function GET(req: NextRequest) {
  try {
    const limit = rateLimit(`brevo:${clientIp(req)}`, 30, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }
    const configured = brevoConfigured();
    const contacts = (await listContacts({ limit: 5000 })).filter(
      (c) => c.email && EMAIL_RE.test(c.email),
    );
    const counts = {
      all: contacts.length,
      customers: contacts.filter((c) => isCustomer(c)).length,
      prospects: contacts.filter((c) => !isCustomer(c)).length,
      optedin: contacts.filter((c) => c.marketingOptIn === "Opted In").length,
    };
    const lists = configured ? await listBrevoLists() : [];
    return NextResponse.json({ configured, lists, counts });
  } catch (e) {
    if (e instanceof BrevoNotConfiguredError) {
      return NextResponse.json({ configured: false, lists: [], counts: null });
    }
    return errorResponse(e);
  }
}

/** POST — sync a segment of CRM contacts into a Brevo list. Adds/updates only; never sends. */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`brevo:${clientIp(req)}`, 10, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many syncs. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }
    if (!brevoConfigured()) {
      return NextResponse.json(
        { error: "Brevo isn't connected. Add BREVO_API_KEY in Vercel, then redeploy." },
        { status: 503 },
      );
    }
    const body = await readJson(req);
    const listId = Number(body.listId);
    const rawSegment = typeof body.segment === "string" ? body.segment : "all";
    const segment: Segment = (["all", "customers", "prospects", "optedin"] as string[]).includes(rawSegment)
      ? (rawSegment as Segment)
      : "all";
    if (!Number.isFinite(listId) || listId <= 0) {
      return NextResponse.json({ error: "Choose a Brevo list to sync into." }, { status: 400 });
    }

    const contacts = (await listContacts({ limit: 5000 }))
      .filter((c) => c.email && EMAIL_RE.test(c.email) && inSegment(c, segment))
      .map(toBrevo);

    if (contacts.length === 0) {
      return NextResponse.json({ error: "No contacts match that segment." }, { status: 400 });
    }

    await ensureAttributes();
    const { queued } = await importContacts(listId, contacts);
    return NextResponse.json({ ok: true, queued, segment });
  } catch (e) {
    if (e instanceof BrevoNotConfiguredError) {
      return NextResponse.json(
        { error: "Brevo isn't connected. Add BREVO_API_KEY in Vercel, then redeploy." },
        { status: 503 },
      );
    }
    if (e instanceof Error && /Brevo/i.test(e.message)) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    return errorResponse(e);
  }
}
