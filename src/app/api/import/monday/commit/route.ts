import { NextRequest, NextResponse } from "next/server";
import {
  planCompanies,
  planContacts,
  planDeals,
  planLeads,
  planClientsProgress,
} from "@/lib/monday/mapping";
import {
  createCompaniesBatch,
  createCompaniesReturning,
  createContactsBatch,
  createDealsBatch,
  listCompanies,
  updateCompaniesHealth,
} from "@/lib/crm/data";
import { MondayError, MondayNotConfiguredError } from "@/lib/monday/client";
import { AirtableError } from "@/lib/airtable";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

// Writes up to ~1,500 records in batches of 10; allow headroom.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`monday-commit:${clientIp(req)}`, 6, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many import runs. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const body = await readJson(req);
    const boardId = typeof body.boardId === "string" ? body.boardId : "";
    const target = typeof body.target === "string" ? body.target : "";
    if (!boardId) return NextResponse.json({ error: "Missing boardId" }, { status: 400 });
    let created = 0;
    let duplicates = 0;
    let skipped = 0;
    let companiesCreated = 0;

    if (target === "companies") {
      const plan = await planCompanies(boardId);
      created = await createCompaniesBatch(plan.toCreate);
      duplicates = plan.duplicates;
      skipped = plan.skipped;
    } else if (target === "contacts") {
      const plan = await planContacts(boardId);
      created = await createContactsBatch(plan.toCreate);
      duplicates = plan.duplicates;
      skipped = plan.skipped;
    } else if (target === "deals") {
      const plan = await planDeals(boardId);
      created = await createDealsBatch(plan.toCreate);
      duplicates = plan.duplicates;
      skipped = plan.skipped;
    } else if (target === "leads") {
      const plan = await planLeads(boardId);
      await createCompaniesReturning(plan.newCompanies);
      const all = await listCompanies();
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const nameToId = new Map(all.map((c) => [norm(c.name), c.id]));
      const contactInputs = plan.contacts.map(({ input, companyName }) => ({
        ...input,
        companyId: companyName ? nameToId.get(norm(companyName)) : undefined,
      }));
      created = await createContactsBatch(contactInputs);
      companiesCreated = plan.newCompanies.length;
      duplicates = plan.duplicates;
      skipped = plan.skipped;
    } else if (target === "clientsprogress") {
      const plan = await planClientsProgress(boardId);
      created = await updateCompaniesHealth(plan.updates);
      duplicates = plan.unmatched;
      skipped = plan.noStatus;
    } else {
      return NextResponse.json({ error: "This board's import isn't ready yet." }, { status: 400 });
    }

    return NextResponse.json({ target, created, duplicates, skipped, companies: companiesCreated });
  } catch (e) {
    if (e instanceof MondayNotConfiguredError) {
      return NextResponse.json(
        { error: "Monday import is not configured. Set MONDAY_API_TOKEN in Vercel." },
        { status: 503 },
      );
    }
    if (e instanceof MondayError) {
      const status = e.status >= 400 && e.status < 500 ? e.status : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    if (e instanceof AirtableError) {
      console.error("[import] airtable write failed", e.status);
      if (e.status === 403) {
        return NextResponse.json(
          {
            error:
              "Airtable refused the write — the API token is read-only. Add the 'data.records:write' scope to your Airtable token, then run the import again.",
          },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: `Airtable rejected the write (status ${e.status}).` }, { status: 502 });
    }
    return errorResponse(e);
  }
}
