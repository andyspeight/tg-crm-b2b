import "server-only";
import { generateDigest, type Digest } from "./digest";
import { getAccessToken } from "@/lib/google/oauth";
import { sendGmailRich } from "@/lib/google/gmail";
import { appBaseUrl } from "@/lib/base-url";
import { formatMoney } from "@/lib/format";

/**
 * Weekly digest email — the same Monday-morning brief shown in-app, delivered to
 * the connected mailbox so Andy gets the week's state without logging in. Sent
 * from his own Gmail (like every other 1:1 send), on a Vercel cron or on demand.
 */

export interface WeeklyDigestResult {
  sent: boolean;
  reason?: string;
  to?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn the digest narrative (plain text, blank-line paragraphs) into HTML paragraphs. */
function narrativeHtml(narrative: string): string {
  return narrative
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155">${esc(p).replace(
          /\n/g,
          "<br>",
        )}</p>`,
    )
    .join("");
}

function statCell(label: string, value: string, accent = "#0F172A"): string {
  return `
    <td style="padding:6px" width="50%">
      <div style="border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;background:#F8FAFC">
        <div style="font-size:12px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:#94A3B8">${esc(label)}</div>
        <div style="margin-top:4px;font-size:22px;font-weight:700;color:${accent}">${esc(value)}</div>
      </div>
    </td>`;
}

/** Full HTML email for the weekly digest. Table-based + inline styles for mail clients. */
export function renderDigestEmailHtml(digest: Digest, baseUrl: string | null): string {
  const f = digest.facts;
  const priced = f.dealsWithValue > 0;
  const pipelineValue = priced ? `${formatMoney(f.openMrr)}/mo` : "—";

  const priorities = f.topPriorities.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 8px">
        ${f.topPriorities
          .map(
            (p) => `<tr><td style="padding:8px 0;border-bottom:1px solid #F1F5F9">
              <span style="font-size:14px;color:#0F172A;font-weight:500">${esc(p.label)}</span>
              ${p.company ? `<span style="font-size:13px;color:#94A3B8"> · ${esc(p.company)}</span>` : ""}
            </td></tr>`,
          )
          .join("")}
      </table>`
    : `<p style="font-size:14px;color:#94A3B8;margin:4px 0">Nothing flagged — you're on top of it.</p>`;

  const atRisk = f.atRisk.length
    ? `<p style="margin:4px 0 0;font-size:13px;color:#64748B">At risk: ${f.atRisk
        .map((a) => `${esc(a.name)} (${esc(a.health)})`)
        .join(" · ")}</p>`
    : "";

  return `<!-- weekly digest -->
<div style="margin:0;padding:24px 12px;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
    <tr><td style="background:#1B2B5B;border-radius:16px 16px 0 0;padding:22px 24px">
      <div style="font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#48CAE4">Luna Desk</div>
      <div style="margin-top:2px;font-size:20px;font-weight:700;color:#ffffff">Your week ahead</div>
      <div style="margin-top:2px;font-size:13px;color:#C7D2E4">${esc(digest.generatedFor)}</div>
    </td></tr>
    <tr><td style="background:#ffffff;padding:22px 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px">
        <tr>
          ${statCell("Open pipeline", pipelineValue)}
          ${statCell("Open deals", String(f.openDeals))}
        </tr>
        <tr>
          ${statCell("At risk", String(f.atRisk.length), f.atRisk.length ? "#F59E0B" : "#0F172A")}
          ${statCell("Overdue care", String(f.overdueCare), f.overdueCare ? "#EF4444" : "#0F172A")}
        </tr>
      </table>
      ${!priced ? `<p style="margin:0 0 14px;font-size:12px;color:#94A3B8">No deal values set — add MRR to deals to forecast revenue.</p>` : ""}

      ${narrativeHtml(digest.narrative)}

      <div style="margin:18px 0 8px;font-size:13px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:#94A3B8">This week's priorities</div>
      ${priorities}
      ${atRisk}

      ${
        baseUrl
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px">
        <tr><td style="border-radius:10px;background:#00B4D8">
          <a href="${esc(baseUrl)}/today" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">Open Luna Desk →</a>
        </td></tr>
      </table>`
          : ""
      }
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:0 0 16px 16px;border-top:1px solid #F1F5F9;padding:14px 24px">
      <div style="font-size:12px;color:#94A3B8">Sent by Luna Desk · ${f.tasksDueThisWeek} task${f.tasksDueThisWeek === 1 ? "" : "s"} and ${f.careDueThisWeek} care touch${f.careDueThisWeek === 1 ? "" : "es"} due this week.</div>
    </td></tr>
  </table>
</div>`;
}

/**
 * Generate this week's digest and email it to the connected mailbox. Returns a
 * result rather than throwing when Gmail isn't connected, so a cron tick can
 * no-op cleanly.
 */
export async function sendWeeklyDigest(): Promise<WeeklyDigestResult> {
  let sender: { accessToken: string; email: string; name?: string };
  try {
    sender = await getAccessToken();
  } catch {
    return { sent: false, reason: "Gmail isn't connected — connect it in Settings to receive the weekly digest." };
  }

  const digest = await generateDigest();
  const html = renderDigestEmailHtml(digest, appBaseUrl());

  await sendGmailRich({
    accessToken: sender.accessToken,
    fromEmail: sender.email,
    fromName: sender.name,
    to: sender.email,
    subject: `Luna Desk — your week ahead (${digest.generatedFor})`,
    html,
  });

  return { sent: true, to: sender.email };
}
