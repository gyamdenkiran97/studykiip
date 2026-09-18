import "server-only";
import { env } from "../env";
import { logger } from "../logger";

/**
 * Small fixed-window rate limiter used for authentication, coupon attempts,
 * review submission, search and webhook abuse control.
 *
 * Two stores: an in-process map (development, tests, single instance) and an
 * Upstash Redis REST store (multi-instance production) implemented with plain
 * fetch so no extra client dependency is needed.
 */

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}

class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number) {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const bucket = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
      if (this.buckets.size > 10_000) this.evict(now);
      return bucket;
    }
    existing.count += 1;
    return existing;
  }

  async reset(key: string) {
    this.buckets.delete(key);
  }

  private evict(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

class UpstashStore implements RateLimitStore {
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async command(command: unknown[]): Promise<unknown> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Upstash error ${response.status}`);
    const payload = (await response.json()) as { result: unknown };
    return payload.result;
  }

  async increment(key: string, windowMs: number) {
    const count = Number(await this.command(["INCR", key]));
    if (count === 1) await this.command(["PEXPIRE", key, windowMs]);
    const ttl = Number(await this.command(["PTTL", key]));
    return { count, resetAt: Date.now() + (ttl > 0 ? ttl : windowMs) };
  }

  async reset(key: string) {
    await this.command(["DEL", key]);
  }
}

let store: RateLimitStore =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new UpstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN)
    : new MemoryStore();

/** Test hook. */
export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

export async function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  try {
    const { count, resetAt } = await store.increment(key, options.windowMs);
    return {
      success: count <= options.limit,
      limit: options.limit,
      remaining: Math.max(0, options.limit - count),
      resetAt,
    };
  } catch (error) {
    // A limiter outage must not take the site down; log loudly and allow.
    logger.error("ratelimit.store_error", { key, error });
    return { success: true, limit: options.limit, remaining: options.limit, resetAt: Date.now() };
  }
}

export async function resetRateLimit(key: string): Promise<void> {
  await store.reset(key);
}

/** Named policies so limits are declared in one place, not scattered. */
export const RATE_LIMITS = {
  signIn: { limit: 8, windowMs: 10 * 60_000 },
  signUp: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  coupon: { limit: 15, windowMs: 10 * 60_000 },
  review: { limit: 5, windowMs: 60 * 60_000 },
  search: { limit: 90, windowMs: 60_000 },
  contact: { limit: 5, windowMs: 60 * 60_000 },
  checkout: { limit: 20, windowMs: 10 * 60_000 },
} as const;
