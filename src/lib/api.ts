import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/crm/data";
import { AirtableError } from "@/lib/airtable";

/** Map thrown errors to safe JSON responses. Never leak internals to the client. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ValidationError) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  if (e instanceof AirtableError) {
    if (e.status === 404) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (e.status === 422) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    console.error("[api] airtable error:", e.message);
    return NextResponse.json({ error: "Upstream data error" }, { status: 502 });
  }
  console.error("[api] unexpected error:", e);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

/** Parse a JSON body, tolerating empty/invalid bodies. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
