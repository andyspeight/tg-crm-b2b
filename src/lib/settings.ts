import "server-only";

/**
 * Tiny server-only key/value store backed by the Airtable "App Settings" table.
 * Holds app runtime settings that can't be build-time env vars — e.g. the Google
 * OAuth refresh token (encrypted before it gets here; see src/lib/google/oauth.ts)
 * and the connected email address. Never import from client code.
 */

import { AIRTABLE_BASE_ID, TABLES, FIELDS } from "@/lib/crm/config";
import { createRecord, deleteRecord, listRecords, updateRecord } from "@/lib/airtable";

const T = TABLES.appSettings;
const F = FIELDS.appSettings;

function safeKey(key: string): string {
  // Keys are app-controlled constants, but escape defensively for the formula.
  return key.replace(/["\\]/g, "");
}

async function findRecord(key: string): Promise<{ id: string; value: string } | null> {
  const recs = await listRecords(AIRTABLE_BASE_ID, T, {
    filterByFormula: `{${F.key}}="${safeKey(key)}"`,
    maxRecords: 1,
  });
  const rec = recs[0];
  if (!rec) return null;
  const value = rec.fields[F.value];
  return { id: rec.id, value: typeof value === "string" ? value : "" };
}

export async function getSetting(key: string): Promise<string | null> {
  const rec = await findRecord(key);
  return rec ? rec.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await findRecord(key);
  const fields = {
    [F.key]: key,
    [F.value]: value,
    [F.updated]: new Date().toISOString(),
  };
  if (existing) {
    await updateRecord(AIRTABLE_BASE_ID, T, existing.id, fields);
  } else {
    await createRecord(AIRTABLE_BASE_ID, T, fields);
  }
}

export async function deleteSetting(key: string): Promise<void> {
  const existing = await findRecord(key);
  if (existing) await deleteRecord(AIRTABLE_BASE_ID, T, existing.id);
}
