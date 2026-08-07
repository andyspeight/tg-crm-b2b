/**
 * Merge tags for email personalisation. Pure and dependency-free so both the
 * client composer (live preview) and the server send route use the same rules.
 */

export interface MergeVars {
  firstName?: string;
  company?: string;
}

/** First word of a full name, or a friendly fallback. */
export function firstNameOf(fullName?: string): string {
  const first = (fullName || "").trim().split(/\s+/)[0];
  return first || "there";
}

/** Replace {{first_name}} and {{company}} (any spacing/case) with real values. */
export function fillMergeTags(input: string, vars: MergeVars): string {
  const first = (vars.firstName ?? "").trim() || "there";
  const company = (vars.company ?? "").trim() || "your company";
  return input
    .replace(/\{\{\s*first_name\s*\}\}/gi, first)
    .replace(/\{\{\s*company\s*\}\}/gi, company);
}
