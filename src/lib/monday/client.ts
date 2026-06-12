import "server-only";

/**
 * Minimal Monday.com GraphQL client (https://api.monday.com/v2).
 * Reads MONDAY_API_TOKEN server-side only. No API-Version header is sent, so
 * Monday uses the account's current stable version — the fields we read
 * (boards, items_count, columns) are stable across versions.
 */

const ENDPOINT = "https://api.monday.com/v2";

export class MondayNotConfiguredError extends Error {
  constructor() {
    super("MONDAY_API_TOKEN is not set");
    this.name = "MondayNotConfiguredError";
  }
}

export class MondayError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "MondayError";
    this.status = status;
  }
}

export async function mondayQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) throw new MondayNotConfiguredError();

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: variables ?? {} }),
      cache: "no-store",
    });
  } catch {
    throw new MondayError("Could not reach Monday. Try again shortly.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new MondayError("Monday rejected the token. Check MONDAY_API_TOKEN in Vercel.", 401);
  }
  if (res.status === 429) {
    throw new MondayError("Monday rate limit reached. Try again in a minute.", 429);
  }

  const body = (await res.json().catch(() => null)) as
    | { data?: T; errors?: { message?: string }[] }
    | null;

  if (!res.ok || !body) throw new MondayError(`Monday request failed (${res.status})`);
  if (body.errors?.length) {
    throw new MondayError(body.errors.map((e) => e.message).filter(Boolean).join("; ") || "Monday error");
  }
  return body.data as T;
}
