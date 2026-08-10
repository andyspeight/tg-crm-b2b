import { NextRequest, NextResponse } from "next/server";
import { getMeetingConfig } from "@/lib/crm/data";
import { normalizeHost } from "@/lib/meetings";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Proxy the scheduler's public availability so the composer can offer specific
 * time slots without a cross-origin call (and without exposing the host/widget
 * id to the client). Returns { timezone, connected, slots:[{startISO}] }.
 */
export async function GET(req: NextRequest) {
  try {
    const cfg = await getMeetingConfig();
    if (!cfg.widgetId) {
      return NextResponse.json({ error: "No scheduler configured." }, { status: 400 });
    }
    const eventId = req.nextUrl.searchParams.get("eventId") || "";
    const daysRaw = Number(req.nextUrl.searchParams.get("days"));
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(30, Math.floor(daysRaw)) : 14;

    const from = new Date().toISOString();
    const to = new Date(Date.now() + days * 864e5).toISOString();
    const url =
      `${normalizeHost(cfg.host)}/api/appointment/availability?widgetId=${encodeURIComponent(cfg.widgetId)}` +
      (eventId ? `&eventId=${encodeURIComponent(eventId)}` : "") +
      `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: `Scheduler returned ${res.status}.` }, { status: 502 });
    }
    const data = (await res.json().catch(() => ({}))) as {
      timezone?: string;
      connected?: boolean;
      slots?: { startISO?: string }[];
    };
    const slots = Array.isArray(data.slots)
      ? data.slots.map((s) => ({ startISO: String(s.startISO || "") })).filter((s) => s.startISO)
      : [];
    return NextResponse.json({ timezone: data.timezone || "Europe/London", connected: !!data.connected, slots });
  } catch (e) {
    return errorResponse(e);
  }
}
