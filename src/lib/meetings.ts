import type { MeetingConfig, MeetingOption } from "@/lib/crm/types";

/**
 * Meeting-link helpers for the Travelgenix Appointment Scheduler (the tg-widgets
 * booking widget — our own scheduler, not Calendly). Pure string logic, safe to
 * import anywhere. A scheduler instance has a widget id and a set of event types
 * ({id,label}); a booking link scopes the widget to one event so the recipient
 * lands straight on that meeting's availability.
 */

export const DEFAULT_MEETING_HOST = "https://tg-widgets.vercel.app";

/** Normalise a host to an https origin with no trailing slash. */
export function normalizeHost(host?: string): string {
  const h = (host || "").trim().replace(/\/+$/, "");
  if (!h) return DEFAULT_MEETING_HOST;
  return /^https?:\/\//i.test(h) ? h : `https://${h}`;
}

/** Coerce stored/loose config into a clean MeetingConfig. */
export function normalizeMeetingConfig(raw: unknown): MeetingConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const options: MeetingOption[] = Array.isArray(o.options)
    ? o.options
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x) => ({
          id: String(x.id || x.eventId || "").trim() || cryptoId(),
          label: String(x.label || "").trim(),
          eventId: String(x.eventId || "").trim(),
          mins: Number.isFinite(Number(x.mins)) ? Number(x.mins) : undefined,
          description: x.description ? String(x.description).trim() : undefined,
        }))
        .filter((x) => x.label && x.eventId)
    : [];
  return {
    host: normalizeHost(typeof o.host === "string" ? o.host : ""),
    widgetId: String(o.widgetId || "").trim(),
    options,
  };
}

/** Deterministic-ish id when one is missing (no Math.random reliance in tests). */
function cryptoId(): string {
  return `opt_${Math.abs(hashStr(String(Date.now())))}`;
}
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** True when the config can actually produce booking links. */
export function meetingConfigReady(cfg: MeetingConfig): boolean {
  return !!cfg.widgetId && cfg.options.length > 0;
}

/** Public booking link — recipient picks any available slot for this event. */
export function bookingLink(cfg: MeetingConfig, opt: MeetingOption): string {
  if (!cfg.widgetId || !opt.eventId) return "";
  const host = normalizeHost(cfg.host);
  return `${host}/book-appointment?widget=${encodeURIComponent(cfg.widgetId)}&event=${encodeURIComponent(opt.eventId)}`;
}

/** One pre-selected slot's booking link (the "send time options" flow). */
export function slotBookingLink(
  cfg: MeetingConfig,
  opt: MeetingOption,
  startISO: string,
  offered: string[] = [],
): string {
  if (!cfg.widgetId || !opt.eventId || !startISO) return "";
  const host = normalizeHost(cfg.host);
  const offeredParam = offered.length ? `&offered=${encodeURIComponent(offered.join(","))}` : "";
  return (
    `${host}/book-appointment?widget=${encodeURIComponent(cfg.widgetId)}` +
    `&event=${encodeURIComponent(opt.eventId)}&start=${encodeURIComponent(startISO)}${offeredParam}`
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Email-safe CTA button linking to a meeting's booking page. */
export function meetingButtonHtml(label: string, url: string): string {
  return (
    `<a href="${esc(url)}" style="display:inline-block;padding:10px 18px;background:#00B4D8;` +
    `color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">` +
    `${esc(label)} &rarr;</a>`
  );
}
