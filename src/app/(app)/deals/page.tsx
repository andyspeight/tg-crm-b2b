import { redirect } from "next/navigation";

// Deals now live inside the Pipeline as a filterable table view.
export default function DealsPage() {
  redirect("/pipeline?view=table");
}
