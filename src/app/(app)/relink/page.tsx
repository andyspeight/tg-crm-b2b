import { redirect } from "next/navigation";

// Folded into the Data health hub (/data). Kept as a redirect so existing
// bookmarks and in-app links to /relink still land on the right tool.
export default function RelinkRedirect() {
  redirect("/data?tab=relink");
}
