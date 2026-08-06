import { redirect } from "next/navigation";

// Folded into the Data health hub (/data). Kept as a redirect so existing
// bookmarks and in-app links to /enrich still land on the right tool.
export default function EnrichRedirect() {
  redirect("/data?tab=enrich");
}
