/**
 * The app's public origin, for building absolute URLs that live inside emails
 * (tracking pixels, tracked download links). Emails are opened long after the
 * request that sent them — and sequence steps go out from cron with no inbound
 * request — so this must resolve without a request context.
 *
 * Order of preference:
 *  1. APP_BASE_URL — set it explicitly to pin the public domain.
 *  2. GOOGLE_REDIRECT_URI — already configured for OAuth; its origin is us.
 *  3. Vercel's injected production / deployment URLs.
 *
 * Returns null if none resolve, in which case tracking is skipped (a send must
 * never fail because we couldn't build a pixel URL).
 */
export function appBaseUrl(): string | null {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const redirect = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (redirect) {
    try {
      return new URL(redirect).origin;
    } catch {
      /* ignore a malformed value and fall through */
    }
  }

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "")}`;

  const dep = process.env.VERCEL_URL?.trim();
  if (dep) return `https://${dep.replace(/^https?:\/\//, "")}`;

  return null;
}
