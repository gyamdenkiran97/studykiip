import { expect, test } from "@playwright/test";

/**
 * Authorisation, checked from the outside.
 *
 * A customer session must not reach the admin area, and server actions must
 * refuse even when called directly rather than through the interface.
 */
test.describe("authorisation", () => {
  test("a customer cannot open the admin area", async ({ page }) => {
    await page.goto("/admin");
    // Redirected away rather than shown a "forbidden" page that confirms it exists.
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("a customer cannot open an admin sub-page", async ({ page }) => {
    for (const route of ["/admin/orders", "/admin/products", "/admin/settings"]) {
      await page.goto(route);
      await expect(page).not.toHaveURL(new RegExp(route));
    }
  });

  test("the health endpoint reports status without leaking build detail", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(Object.keys(body).sort()).toEqual(["database", "environment", "latencyMs", "status"]);
  });

  test("the payment webhook refuses an unsigned request", async ({ request }) => {
    const response = await request.post("/api/webhooks/stripe", {
      data: { id: "evt_forged", type: "payment_intent.succeeded", data: { object: { id: "pi_forged" } } },
    });
    expect(response.status()).toBe(403);
  });

  test("the payment webhook refuses a wrongly signed request", async ({ request }) => {
    const response = await request.post("/api/webhooks/stripe", {
      headers: { "x-kwidus21-signature": "deadbeef" },
      data: { id: "evt_forged_2", type: "payment_intent.succeeded", data: { object: { id: "pi_forged" } } },
    });
    expect(response.status()).toBe(403);
  });

  test("security headers are present on every response", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    // The framework's own advertisement is switched off.
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("private areas are excluded from robots.txt", async ({ request }) => {
    const response = await request.get("/robots.txt");
    const body = await response.text();

    for (const path of ["/admin", "/account", "/checkout", "/api/"]) {
      expect(body).toContain(`Disallow: ${path}`);
    }
  });

  test("the sitemap lists products but never private pages", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    const body = await response.text();

    expect(body).toContain("/product/");
    expect(body).not.toContain("/admin");
    expect(body).not.toContain("/checkout");
    expect(body).not.toContain("/account");
  });
});
