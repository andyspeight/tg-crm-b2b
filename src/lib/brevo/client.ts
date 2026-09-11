import "server-only";

/**
 * Brevo (v3) API adapter for pushing CRM contacts into Brevo lists. Server-side
 * only — BREVO_API_KEY must never reach the client (travelgenix-security). This
 * only ADDS/updates contacts and list membership; it never sends email. Sending
 * stays a deliberate action inside Brevo/Luna Marketing, which is where consent
 * must be honoured.
 */

const API = "https://api.brevo.com/v3";

export class BrevoNotConfiguredError extends Error {
  constructor() {
    super("BREVO_API_KEY is not set");
    this.name = "BrevoNotConfiguredError";
  }
}

export function brevoConfigured(): boolean {
  return !!process.env.BREVO_API_KEY;
}

function key(): string {
  const k = process.env.BREVO_API_KEY;
  if (!k) throw new BrevoNotConfiguredError();
  return k;
}

async function bfetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      "api-key": key(),
      "content-type": "application/json",
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function bodySnippet(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t ? `: ${t.slice(0, 300)}` : "";
  } catch {
    return "";
  }
}

export interface BrevoList {
  id: number;
  name: string;
  totalSubscribers?: number;
  folderId?: number;
}

/** All contact lists in the Brevo account (paged). */
export async function listBrevoLists(): Promise<BrevoList[]> {
  const out: BrevoList[] = [];
  let offset = 0;
  for (;;) {
    const res = await bfetch(`/contacts/lists?limit=50&offset=${offset}&sort=asc`);
    if (!res.ok) throw new Error(`Brevo: couldn't read your lists (${res.status})${await bodySnippet(res)}`);
    const data = (await res.json()) as { lists?: BrevoList[] };
    const lists = data.lists ?? [];
    out.push(...lists);
    if (lists.length < 50 || offset >= 1000) break;
    offset += 50;
  }
  return out;
}

// Custom contact attributes we populate so segments can be rebuilt inside Brevo.
// FIRSTNAME / LASTNAME are Brevo defaults and don't need creating.
const CUSTOM_ATTRIBUTES = ["COMPANY", "LIFECYCLE", "OPTIN", "SOURCE"] as const;

/** Create any of our custom attributes that don't yet exist (best-effort, idempotent). */
export async function ensureAttributes(): Promise<void> {
  const res = await bfetch(`/contacts/attributes`);
  if (!res.ok) return; // non-fatal: import still works, unknown attrs are ignored
  const data = (await res.json()) as { attributes?: { name: string; category: string }[] };
  const existing = new Set(
    (data.attributes ?? [])
      .filter((a) => a.category === "normal")
      .map((a) => a.name.toUpperCase()),
  );
  for (const name of CUSTOM_ATTRIBUTES) {
    if (!existing.has(name)) {
      await bfetch(`/contacts/attributes/normal/${encodeURIComponent(name)}`, {
        method: "POST",
        body: JSON.stringify({ type: "text" }),
      }).catch(() => {});
    }
  }
}

export interface BrevoContact {
  email: string;
  attributes: Record<string, string>;
}

/**
 * Upsert contacts and add them to a list via the async import endpoint (deduped
 * by email, existing contacts updated). Chunked to keep payloads sane. Returns
 * how many were queued.
 */
export async function importContacts(
  listId: number,
  contacts: BrevoContact[],
): Promise<{ queued: number }> {
  let queued = 0;
  for (let i = 0; i < contacts.length; i += 1000) {
    const chunk = contacts.slice(i, i + 1000);
    const res = await bfetch(`/contacts/import`, {
      method: "POST",
      body: JSON.stringify({
        listIds: [listId],
        updateExistingContacts: true,
        emptyContactsAttributes: false,
        jsonBody: chunk.map((c) => ({ email: c.email, attributes: c.attributes })),
      }),
    });
    if (!res.ok) throw new Error(`Brevo import failed (${res.status})${await bodySnippet(res)}`);
    queued += chunk.length;
  }
  return { queued };
}
