import { NextRequest, NextResponse } from "next/server";
import { personaliseEmail } from "@/lib/ai/personalise";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { getContact, getCompany } from "@/lib/crm/data";
import { errorResponse, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Tailor a draft email (subject + body) to one CRM contact. */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`ai:${clientIp(req)}`, 20, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many AI requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const b = await readJson(req);
    const contactId = typeof b.contactId === "string" ? b.contactId.trim() : "";
    const subject = typeof b.subject === "string" ? b.subject : "";
    const body = typeof b.body === "string" ? b.body : "";
    if (!contactId) return NextResponse.json({ error: "Pick a contact first." }, { status: 400 });
    if (!subject.trim() && !body.trim()) {
      return NextResponse.json({ error: "Nothing to personalise." }, { status: 400 });
    }
    if (subject.length + body.length > 20000) {
      return NextResponse.json({ error: "That email is too long to personalise." }, { status: 400 });
    }

    const contact = await getContact(contactId);
    const company = contact.companyId ? await getCompany(contact.companyId).catch(() => null) : null;

    const result = await personaliseEmail({
      subject,
      body,
      contact: {
        name: contact.name,
        role: contact.role,
        companyName: contact.companyName,
        headline: contact.headline,
        location: contact.location,
        notes: contact.notes,
      },
      company: company
        ? {
            name: company.name,
            type: company.type,
            description: company.description,
            lifecycleStage: company.lifecycleStage,
            productsUsed: company.productsUsed,
          }
        : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { error: "AI is not configured. Set ANTHROPIC_API_KEY in Vercel." },
        { status: 503 },
      );
    }
    return errorResponse(e);
  }
}
