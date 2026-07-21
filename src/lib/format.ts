/** Presentation helpers. Client- and server-safe. */

export function formatMoney(n?: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Tidy a phone number coming from an import or manual entry:
 * - strips a stray leading apostrophe/quote (a spreadsheet text-force artifact);
 * - restores the leading 0 that Excel drops from UK numbers (10 digits starting
 *   1/2/3/7 → 0…), so mobiles/landlines dial correctly.
 * International (+…) and already-0-led numbers, and anything ambiguous, are left
 * untouched.
 */
export function normalizePhone(v?: string | number | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim().replace(/^['"`‘’]+/, "").trim();
  if (!s) return undefined;
  const compact = s.replace(/[\s()\-.]/g, "");
  if (compact.startsWith("+") || compact.startsWith("0")) return s;
  if (/^[1237]\d{9}$/.test(compact)) return "0" + compact;
  return s;
}

export function formatDate(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
