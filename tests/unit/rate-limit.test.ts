import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, RATE_LIMITS, resetRateLimit, setRateLimitStore } from "@/server/rate-limit";

describe("rate limiter", () => {
  beforeEach(async () => {
    await resetRateLimit("test-key");
  });

  it("allows requests up to the limit and blocks the next one", async () => {
    const options = { limit: 3, windowMs: 60_000 };

    const first = await rateLimit("burst", options);
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(2);

    await rateLimit("burst", options);
    const third = await rateLimit("burst", options);
    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = await rateLimit("burst", options);
    expect(fourth.success).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("counts each key separately", async () => {
    const options = { limit: 1, windowMs: 60_000 };
    expect((await rateLimit("user-a", options)).success).toBe(true);
    expect((await rateLimit("user-b", options)).success).toBe(true);
    expect((await rateLimit("user-a", options)).success).toBe(false);
  });

  it("starts a fresh window once the old one expires", async () => {
    const options = { limit: 1, windowMs: 20 };
    expect((await rateLimit("expiring", options)).success).toBe(true);
    expect((await rateLimit("expiring", options)).success).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect((await rateLimit("expiring", options)).success).toBe(true);
  });

  it("fails open when the store is broken, rather than taking the site down", async () => {
    setRateLimitStore({
      increment: async () => {
        throw new Error("redis unavailable");
      },
      reset: async () => undefined,
    });

    const result = await rateLimit("anything", { limit: 1, windowMs: 1000 });
    expect(result.success).toBe(true);
  });

  it("declares stricter limits for authentication than for browsing", async () => {
    expect(RATE_LIMITS.signIn.limit).toBeLessThan(RATE_LIMITS.search.limit);
    expect(RATE_LIMITS.signUp.windowMs).toBeGreaterThanOrEqual(RATE_LIMITS.signIn.windowMs);
  });
});
