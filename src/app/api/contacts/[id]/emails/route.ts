import { NextResponse } from "next/server";
import { getContact, listContactEmails } from "@/lib/crm/data";
import { AirtableError } from "@/lib/airtable";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** One contact plus their email correspondence — powers the People email drawer. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [contact, emails] = await Promise.all([getContact(id), listContactEmails(id)]);
    return NextResponse.json({ contact, emails });
  } catch (e) {
    if (e instanceof AirtableError && e.status === 404) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }
    return errorResponse(e);
  }
}
