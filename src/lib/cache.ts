import "server-only";

/**
 * Tiny in-memory read cache for the warm serverless instance. Luna Desk is
 * single-tenant (one login, one dataset), and pages are server-rendered on every
 * navigation — without this, each page re-hits Airtable from scratch. We memoise
 * reads for a few seconds so repeat navigations are near-instant, and bust the
 * whole cache on any write so the operator's own edits show immediately.
 *
 * Note: per-instance only. Staleness is bounded by the TTL and, in practice, a
 * single user hits one warm instance, so their writes bust the cache they read.
 */

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
let generation = 0;

/** Drop every cached read. Called after any Airtable write. */
export function bustCache(): void {
  generation += 1;
  store.clear();
}

/** Memoise an async read under `key` for `ttlMs`. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const k = `${generation}:${key}`;
  const now = Date.now();
  const hit = store.get(k);
  if (hit && hit.expires > now) return hit.value as T;

  const value = await fn();
  store.set(k, { value, expires: now + ttlMs });

  // Keep the map bounded — evict expired entries when it grows.
  if (store.size > 128) {
    for (const [key2, e] of store) if (e.expires <= now) store.delete(key2);
  }
  return value;
}
