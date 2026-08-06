import { redirect } from "next/navigation";

// Folded into the Data health hub (/data). Kept as a redirect so existing
// bookmarks and in-app links to /tidy still land on the right tool.
export default function TidyRedirect() {
  redirect("/data?tab=tidy");
}
