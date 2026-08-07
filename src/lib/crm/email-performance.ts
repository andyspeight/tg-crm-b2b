import type { Activity, EmailTracking, SequenceEnrollment } from "./types";

/**
 * Email performance, computed from what Luna Desk actually records: every send is
 * an Activity of type "Email", and sequence enrollments carry the outcome
 * (Replied / Completed / Stopped / Failed…). There is no open/click tracking —
 * these are real 1:1 Gmail sends, not a bulk provider — so the honest measure of
 * performance is the reply, which the sequence engine detects on the thread.
 *
 * Pure and deterministic: give it the two lists (+ the current time) and it
 * returns the shaped numbers a server component can hand straight to the view.
 */

export interface SequencePerf {
  id: string;
  name: string;
  enrolled: number;
  active: number;
  replied: number;
  completed: number;
  stopped: number;
  failed: number;
  /** replied ÷ enrolled, 0..1. */
  replyRate: number;
}

export interface EmailFailure {
  contactName?: string;
  contactEmail?: string;
  sequenceName?: string;
  lastError?: string;
}

export interface WeeklyBucket {
  /** Monday of the week, ISO date (yyyy-mm-dd). */
  weekStart: string;
  /** Short label like "9 Jun". */
  label: string;
  sent: number;
}

export interface EmailPerformance {
  sent: { total: number; last30: number; last7: number };
  weekly: WeeklyBucket[];
  reply: { enrolled: number; replied: number; active: number; rate: number };
  outcomes: { active: number; replied: number; completed: number; stopped: number; failed: number; paused: number };
  sequences: SequencePerf[];
  failures: EmailFailure[];
}

const DAY = 864e5;

/** Monday 00:00 (local) of the week containing `t`, as a ms timestamp. */
function weekStartMs(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0=Sun..6=Sat. Shift so Monday is the anchor.
  const dow = (d.getDay() + 6) % 7;
  return d.getTime() - dow * DAY;
}

function shortLabel(t: number): string {
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function parse(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export function computeEmailPerformance(
  emailActivities: Activity[],
  enrollments: SequenceEnrollment[],
  now: number,
  weeks = 8,
): EmailPerformance {
  // --- send volume ----------------------------------------------------------
  const times = emailActivities
    .map((a) => parse(a.date) ?? parse(a.createdTime))
    .filter((t): t is number => t !== null);

  const sent = {
    total: times.length,
    last30: times.filter((t) => t >= now - 30 * DAY).length,
    last7: times.filter((t) => t >= now - 7 * DAY).length,
  };

  // Fixed run of weekly buckets (oldest → newest), so the chart is stable even
  // with gaps. Bucket by Monday.
  const thisWeek = weekStartMs(now);
  const buckets: WeeklyBucket[] = [];
  const index = new Map<number, WeeklyBucket>();
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = thisWeek - i * 7 * DAY;
    const b: WeeklyBucket = { weekStart: new Date(ws).toISOString().slice(0, 10), label: shortLabel(ws), sent: 0 };
    buckets.push(b);
    index.set(ws, b);
  }
  for (const t of times) {
    const b = index.get(weekStartMs(t));
    if (b) b.sent += 1;
  }

  // --- sequence outcomes ----------------------------------------------------
  const outcomes = { active: 0, replied: 0, completed: 0, stopped: 0, failed: 0, paused: 0 };
  const bySeq = new Map<string, SequencePerf>();

  for (const e of enrollments) {
    switch (e.status) {
      case "Active": outcomes.active += 1; break;
      case "Replied": outcomes.replied += 1; break;
      case "Completed": outcomes.completed += 1; break;
      case "Stopped": outcomes.stopped += 1; break;
      case "Failed": outcomes.failed += 1; break;
      case "Paused": outcomes.paused += 1; break;
    }

    const key = e.sequenceId || e.sequenceName || "—";
    let s = bySeq.get(key);
    if (!s) {
      s = {
        id: e.sequenceId || key,
        name: e.sequenceName || "Untitled sequence",
        enrolled: 0,
        active: 0,
        replied: 0,
        completed: 0,
        stopped: 0,
        failed: 0,
        replyRate: 0,
      };
      bySeq.set(key, s);
    }
    s.enrolled += 1;
    if (e.status === "Active") s.active += 1;
    else if (e.status === "Replied") s.replied += 1;
    else if (e.status === "Completed") s.completed += 1;
    else if (e.status === "Stopped") s.stopped += 1;
    else if (e.status === "Failed") s.failed += 1;
  }

  const sequences = [...bySeq.values()]
    .map((s) => ({ ...s, replyRate: s.enrolled ? s.replied / s.enrolled : 0 }))
    .sort((a, b) => b.enrolled - a.enrolled);

  const enrolled = enrollments.length;
  const reply = {
    enrolled,
    replied: outcomes.replied,
    active: outcomes.active,
    rate: enrolled ? outcomes.replied / enrolled : 0,
  };

  const failures: EmailFailure[] = enrollments
    .filter((e) => e.status === "Failed")
    .slice(0, 12)
    .map((e) => ({
      contactName: e.contactName,
      contactEmail: e.contactEmail,
      sequenceName: e.sequenceName,
      lastError: e.lastError,
    }));

  return { sent, weekly: buckets, reply, outcomes, sequences, failures };
}

/** Format a 0..1 rate as a whole-number percentage. */
export function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export interface OpensSummary {
  /** Emails that carried a tracking pixel. */
  tracked: number;
  /** Of those, how many were opened at least once. */
  opened: number;
  /** opened ÷ tracked, 0..1. */
  openRate: number;
  /** Total open events (a keen reader opens more than once). */
  totalOpens: number;
  /** Tracked attachments that were downloaded at least once. */
  downloads: number;
}

/** Roll up the email-tracking rows into open/download headline numbers. */
export function summarizeOpens(trackings: EmailTracking[]): OpensSummary {
  const emails = trackings.filter((t) => t.kind === "Email");
  const opened = emails.filter((t) => t.opens > 0);
  const attachments = trackings.filter((t) => t.kind === "Attachment");
  return {
    tracked: emails.length,
    opened: opened.length,
    openRate: emails.length ? opened.length / emails.length : 0,
    totalOpens: emails.reduce((s, t) => s + t.opens, 0),
    downloads: attachments.filter((t) => t.opens > 0).length,
  };
}
