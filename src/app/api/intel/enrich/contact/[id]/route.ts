import { NextRequest, NextResponse } from "next/server";
import { getContact, updateContact } from "@/lib/crm/data";
import type { Contact, ContactInput } from "@/lib/crm/types";
import {
  IntelNotConfiguredError,
  detectLinkedInKind,
  getProvider,
  normalizeLinkedInUrl,
} from "@/lib/intel/provider";
import type { EnrichedContactData, ProfileCandidate } from "@/lib/intel/types";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

// Bright Data trigger -> poll -> snapshot can take up to ~a minute.
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

type Change = {
  field: keyof ContactInput;
  label: string;
  current: string | null;
  next: string;
  /** fill = was blank; update = replaced an existing value. */
  action: "fill" | "update";
};

const MAX_NOTES = 2000;
const MAX_FIELD = 400;

function clip(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s.slice(0, max) : undefined;
}

/** Keep only the fields we trust, trimmed and length-capped. */
function sanitizeProfile(raw: unknown): EnrichedContactData {
  const p = (raw ?? {}) as Record<string, unknown>;
  return {
    role: clip(p.role, MAX_FIELD),
    headline: clip(p.headline, MAX_FIELD),
    location: clip(p.location, MAX_FIELD),
    notes: clip(p.notes, MAX_NOTES),
    companyName: clip(p.companyName, MAX_FIELD),
    companyLinkedin: clip(p.companyLinkedin, MAX_FIELD),
    linkedin: clip(p.linkedin, MAX_FIELD),
  };
}

/**
 * Merge policy — deliberately conservative (bad data is worse than none):
 *  - headline is LinkedIn-owned, so a fresh scrape overwrites it;
 *  - role / location / notes / linkedin only ever FILL a blank — never clobber
 *    something a human (or the Monday import) already put there.
 * enrichedAt is always stamped but isn't shown as a change row. Returns the patch
 * to persist and the human-readable diff to preview.
 */
function planEnrich(
  contact: Contact,
  profile: EnrichedContactData,
  sourceUrl: string,
): { patch: ContactInput; changes: Change[] } {
  const patch: ContactInput = {};
  const changes: Change[] = [];

  if (profile.headline && profile.headline !== contact.headline) {
    patch.headline = profile.headline;
    changes.push({
      field: "headline",
      label: "Headline",
      current: contact.headline || null,
      next: profile.headline,
      action: contact.headline ? "update" : "fill",
    });
  }
  const fillables: { field: keyof ContactInput; label: string; value?: string; current?: string }[] = [
    { field: "role", label: "Role", value: profile.role, current: contact.role },
    { field: "location", label: "Location", value: profile.location, current: contact.location },
    { field: "notes", label: "Bio", value: profile.notes, current: contact.notes },
    { field: "linkedin", label: "LinkedIn", value: sourceUrl, current: contact.linkedin },
  ];
  for (const f of fillables) {
    if (f.value && !f.current) {
      (patch as Record<string, unknown>)[f.field] = f.value;
      changes.push({ field: f.field, label: f.label, current: null, next: f.value, action: "fill" });
    }
  }
  return { patch, changes };
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const limit = rateLimit(`intel:${clientIp(req)}`, 30, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many lookups. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const { id } = await params;
    const body = await readJson(req);
    const mode = body.mode === "apply" ? "apply" : "lookup";
    const contact = await getContact(id);

    // --- APPLY: persist the confirmed profile (no re-scrape; recompute the merge
    // against the live record so a blank we saw at preview is still blank). ---
    if (mode === "apply") {
      const sourceUrl = normalizeLinkedInUrl(typeof body.sourceUrl === "string" ? body.sourceUrl : "");
      if (detectLinkedInKind(sourceUrl) !== "profile") {
        return NextResponse.json({ error: "A LinkedIn profile URL is required to save." }, { status: 400 });
      }
      const profile = sanitizeProfile(body.profile);
      const { patch, changes } = planEnrich(contact, profile, sourceUrl);
      patch.enrichedAt = new Date().toISOString();
      const updated = await updateContact(id, patch);
      return NextResponse.json({ applied: true, contact: updated, changes });
    }

    // --- LOOKUP: resolve a profile URL, scrape it, return a preview. No writes. ---
    const provider = getProvider();

    const pasted = typeof body.url === "string" ? body.url.trim() : "";
    let sourceUrl = "";
    let autoFound = false;
    let candidate: ProfileCandidate | null = null;

    if (pasted) {
      sourceUrl = normalizeLinkedInUrl(pasted);
      if (detectLinkedInKind(sourceUrl) !== "profile") {
        return NextResponse.json(
          { error: "That isn't a LinkedIn profile (/in/) URL." },
          { status: 400 },
        );
      }
    } else if (contact.linkedin && detectLinkedInKind(normalizeLinkedInUrl(contact.linkedin)) === "profile") {
      sourceUrl = normalizeLinkedInUrl(contact.linkedin);
    } else {
      // No URL on file — hunt for one by name (+ company), to be confirmed.
      candidate = await provider.discoverProfileUrl(contact.name, contact.companyName);
      if (!candidate) {
        return NextResponse.json({
          found: false,
          reason: "not-found",
          message: `Couldn't find a LinkedIn profile for "${contact.name}" automatically. Paste their profile URL to enrich.`,
        });
      }
      sourceUrl = candidate.url;
      autoFound = true;
    }

    const profile = await provider.profileFromUrl(sourceUrl);
    const { changes } = planEnrich(contact, profile, sourceUrl);

    return NextResponse.json({
      found: true,
      sourceUrl,
      autoFound,
      candidate: candidate ? { title: candidate.title, snippet: candidate.snippet } : null,
      profile,
      changes,
      contact: { name: contact.name, companyName: contact.companyName },
    });
  } catch (e) {
    if (e instanceof IntelNotConfiguredError) {
      return NextResponse.json(
        { error: "Enrichment is not configured. Set BRIGHTDATA_API_KEY in Vercel." },
        { status: 503 },
      );
    }
    if (e instanceof Error && /Bright Data/i.test(e.message)) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    return errorResponse(e);
  }
}
