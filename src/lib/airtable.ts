import "server-only";

/**
 * Thin server-only Airtable REST client. The PAT is read from the environment on
 * every call and never leaves the server. UI code must go through src/lib/crm/data.ts,
 * never this module directly.
 */

const API_BASE = "https://api.airtable.com/v0";

export interface AirtableRecord<T = Record<string, unknown>> {
  id: string;
  createdTime: string;
  fields: T;
}

export class AirtableError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`Airtable request failed (${status}): ${body}`);
    this.status = status;
    this.name = "AirtableError";
  }
}

function authHeader(): string {
  const key = process.env.AIRTABLE_API_KEY;
  if (!key) throw new Error("AIRTABLE_API_KEY is not set");
  return `Bearer ${key}`;
}

async function request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    // CRM data is always live; never cache.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new AirtableError(res.status, await res.text());
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface ListOptions {
  filterByFormula?: string;
  sort?: { field: string; direction?: "asc" | "desc" }[];
  fields?: string[];
  maxRecords?: number;
  pageSize?: number;
}

export async function listRecords<T = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  opts: ListOptions = {},
): Promise<AirtableRecord<T>[]> {
  const out: AirtableRecord<T>[] = [];
  const cap = opts.maxRecords ?? 1000;
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (opts.filterByFormula) params.set("filterByFormula", opts.filterByFormula);
    if (opts.maxRecords) params.set("maxRecords", String(opts.maxRecords));
    if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
    (opts.sort || []).forEach((s, i) => {
      params.set(`sort[${i}][field]`, s.field);
      params.set(`sort[${i}][direction]`, s.direction || "asc");
    });
    (opts.fields || []).forEach((f) => params.append("fields[]", f));
    if (offset) params.set("offset", offset);

    const data = await request<{ records: AirtableRecord<T>[]; offset?: string }>(
      `${baseId}/${tableId}?${params.toString()}`,
    );
    out.push(...(data.records || []));
    offset = data.offset;
  } while (offset && out.length < cap);

  return out;
}

export function getRecord<T = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  recordId: string,
): Promise<AirtableRecord<T>> {
  return request<AirtableRecord<T>>(`${baseId}/${tableId}/${recordId}`);
}

export function createRecord<T = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord<T>> {
  return request<AirtableRecord<T>>(`${baseId}/${tableId}`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
}

/** Create many records, chunked to Airtable's 10-per-request limit. */
export async function createRecords<T = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  fieldsList: Record<string, unknown>[],
): Promise<AirtableRecord<T>[]> {
  const out: AirtableRecord<T>[] = [];
  for (let i = 0; i < fieldsList.length; i += 10) {
    const chunk = fieldsList.slice(i, i + 10).map((fields) => ({ fields }));
    const data = await request<{ records: AirtableRecord<T>[] }>(`${baseId}/${tableId}`, {
      method: "POST",
      body: JSON.stringify({ records: chunk }),
    });
    out.push(...(data.records || []));
  }
  return out;
}

export function updateRecord<T = Record<string, unknown>>(
  baseId: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord<T>> {
  return request<AirtableRecord<T>>(`${baseId}/${tableId}/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });
}

export async function deleteRecord(
  baseId: string,
  tableId: string,
  recordId: string,
): Promise<void> {
  await request(`${baseId}/${tableId}/${recordId}`, { method: "DELETE" });
}
