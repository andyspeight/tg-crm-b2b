/**
 * Best-effort in-memory rate limiter. On Vercel this is per warm instance, so it
 * is not perfectly distributed, but it raises the cost of brute force and abuse
 * meaningfully. Upgrade to Upstash Redis (@upstash/ratelimit) for production-grade
 * distributed limiting once traffic justifies it (travelgenix-security §API rate
 * limiting).
 */

type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  bucket.count += 1;
  const ok = bucket.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: ok ? 0 : Math.ceil((bucket.reset - now) / 1000),
  };
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}
