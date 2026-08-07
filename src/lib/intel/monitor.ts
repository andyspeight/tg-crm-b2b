import "server-only";

/**
 * The intel monitor. On each tick (Vercel cron or a manual run) it does two
 * bounded passes over the account base, round-robin so the whole base is covered
 * over several runs while spend stays capped:
 *
 *  1. Signals — a cheap SERP search per company, scored into buying/intent
 *     signals (funding, M&A, hires, awards, expansion…), deduped by URL.
 *  2. Backfill — a LinkedIn scrape for accounts that have a LinkedIn URL but
 *     haven't been enriched yet, filling only empty fields.
 *
 * Both passes are hard-capped per run (env-tunable) and share a wall-clock
 * budget so a slow scrape can never blow the serverless limit.
 */

import {
  companiesForBackfill,
  companiesForSignalScan,
  createSignal,
  existingSignalUrls,
  updateCompany,
} from "@/lib/crm/data";
import type { Company, CompanyInput } from "@/lib/crm/types";
import { IntelNotConfiguredError, getProvider } from "./provider";
import { detectSignals, signalQuery } from "./signals";

// Leave headroom under the route's maxDuration (300s) so we always return cleanly.
const TIME_BUDGET_MS = 270_000;

function cap(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw < 0) return fallback;
  return Math.min(50, Math.floor(raw));
}

export interface MonitorSummary {
  ran: boolean;
  reason?: string;
  companiesScanned: number;
  signalsCreated: number;
  backfilled: number;
  errors: number;
}

export async function runMonitor(): Promise<MonitorSummary> {
  const summary: MonitorSummary = {
    ran: false,
    companiesScanned: 0,
    signalsCreated: 0,
    backfilled: 0,
    errors: 0,
  };

  let provider: ReturnType<typeof getProvider>;
  try {
    provider = getProvider();
  } catch (e) {
    if (e instanceof IntelNotConfiguredError) {
      return { ...summary, reason: "Bright Data isn't configured (BRIGHTDATA_API_KEY)." };
    }
    throw e;
  }
  summary.ran = true;

  const started = Date.now();
  const timeLeft = () => Date.now() - started < TIME_BUDGET_MS;

  const signalsCap = cap("INTEL_SIGNALS_PER_RUN", 12);
  const backfillCap = cap("INTEL_BACKFILL_PER_RUN", 3);

  // --- signals pass (fast SERP) ---------------------------------------------
  if (signalsCap > 0) {
    const companies = await companiesForSignalScan(signalsCap);
    for (const company of companies) {
      if (!timeLeft()) break;
      summary.companiesScanned += 1;
      try {
        const results = await provider.search(signalQuery(company.name));
        const candidates = detectSignals(company.name, results);
        if (candidates.length) {
          const seen = await existingSignalUrls(company.id);
          for (const c of candidates) {
            if (seen.has(c.url.toLowerCase())) continue;
            await createSignal({
              headline: c.headline,
              url: c.url,
              type: c.type,
              relevanceScore: c.relevanceScore,
              status: "New",
              companyId: company.id,
            });
            summary.signalsCreated += 1;
          }
        }
      } catch (e) {
        summary.errors += 1;
        console.error(`[intel] signal scan failed for ${company.name}:`, e);
      }
      // Stamp regardless of outcome so the round-robin keeps moving.
      await updateCompany(company.id, { signalsCheckedAt: new Date().toISOString() }).catch(() => {});
    }
  }

  // --- backfill pass (slow LinkedIn scrape) ---------------------------------
  if (backfillCap > 0 && timeLeft()) {
    const companies = await companiesForBackfill(backfillCap);
    for (const company of companies) {
      if (!timeLeft()) break;
      try {
        const data = await provider.companyFromUrl(company.linkedin!);
        const input = fillGaps(company, data);
        input.enrichedAt = new Date().toISOString();
        input.enrichmentSource = "Bright Data (auto)";
        await updateCompany(company.id, input);
        summary.backfilled += 1;
      } catch (e) {
        summary.errors += 1;
        console.error(`[intel] backfill failed for ${company.name}:`, e);
      }
    }
  }

  return summary;
}

/** Only fill fields the account is missing — never clobber curated data. */
function fillGaps(company: Company, data: { website?: string; description?: string; sizeBand?: string; country?: string; socials?: string }): CompanyInput {
  const input: CompanyInput = {};
  if (!company.website && data.website) input.website = data.website;
  if (!company.description && data.description) input.description = data.description;
  if (!company.sizeBand && data.sizeBand) input.sizeBand = data.sizeBand as Company["sizeBand"];
  if (!company.country && data.country) input.country = data.country;
  if (!company.socials && data.socials) input.socials = data.socials;
  return input;
}
