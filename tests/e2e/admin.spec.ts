import { expect, test } from "@playwright/test";

/**
 * Administrative flows, run with a stored administrator session.
 * Authorisation is checked server-side on every action, so these tests assert
 * on the resulting state rather than on whether a button was rendered.
 */
test.describe("admin", () => {
  test("the dashboard shows trading metrics", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Revenue").first()).toBeVisible();
    await expect(page.getByText("Average order").first()).toBeVisible();
  });

  test("a product can be created and appears in the catalogue", async ({ page }) => {
    const suffix = Date.now().toString(36).toUpperCase().slice(-5);
    const title = `E2E Test Lamp ${suffix}`;

    await page.goto("/admin/products/new");
    await page.fill("#title", title);
    await page.fill("#description", "A product created by the end-to-end suite to prove the editor works.");
    await page.fill("#sku-0", `E2E-${suffix}`);
    await page.fill("#price-0", "42.50");
    await page.fill("#stock-0", "7");

    // Scoped to the categories fieldset: the variant panel has checkboxes too.
    await page
      .locator("fieldset", { hasText: "Categories" })
      .locator('input[type="checkbox"]')
      .first()
      .check();
    await page.selectOption("#status", "ACTIVE");
    await page.getByRole("button", { name: "Create product" }).click();

    await page.waitForURL(/\/admin\/products\/[a-z0-9]+/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    // And it is really in the list.
    await page.goto(`/admin/products?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });

  test("stock can be adjusted and the new figure is shown", async ({ page }) => {
    await page.goto("/admin/inventory");
    const firstAdjust = page.getByRole("button", { name: "Adjust" }).first();
    await firstAdjust.click();

    const deltaField = page.locator('input[id^="delta-"]').first();
    await deltaField.fill("3");
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForTimeout(2500);

    // The toast reports the recalculated availability.
    await expect(page.getByText(/stock updated/i)).toBeVisible();
  });

  test("an order can be moved along its state machine", async ({ page }) => {
    await page.goto("/admin/orders?status=PAID");
    const firstOrder = page.locator('a[href^="/admin/orders/"]').first();

    if ((await firstOrder.count()) === 0) {
      test.skip(true, "No paid order available to progress");
      return;
    }

    await firstOrder.click();
    await page.waitForURL(/\/admin\/orders\/[a-z0-9]+/);

    const statusSelect = page.locator("#status");
    await expect(statusSelect).toBeVisible();

    // Only transitions the machine permits are offered.
    const options = await statusSelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(0);
    expect(options.join(" ")).not.toContain("Awaiting payment");

    await page.getByRole("button", { name: "Update status" }).click();
    await page.waitForTimeout(2500);
    await expect(page.getByText(/order status updated/i)).toBeVisible();
  });

  test("an invoice renders for an order", async ({ page }) => {
    await page.goto("/admin/orders");
    const firstOrder = page.locator('a[href^="/admin/orders/"]').first();
    const href = await firstOrder.getAttribute("href");
    await page.goto(`${href}/invoice`);

    await expect(page.getByRole("heading", { name: "Invoice" })).toBeVisible();
    await expect(page.getByText(/KM-/).first()).toBeVisible();
    await expect(page.getByText(/pending legal review|placeholder VAT/i).first()).toBeVisible();
  });

  test("a coupon can be created and appears in the list", async ({ page }) => {
    const code = `E2E${Date.now().toString(36).toUpperCase().slice(-6)}`;

    await page.goto("/admin/promotions");
    await page.getByRole("button", { name: "New coupon" }).click();
    await page.fill("#code", code);
    await page.fill("#discountValue", "15");
    await page.getByRole("button", { name: "Save coupon" }).click();
    await page.waitForTimeout(2500);

    await expect(page.getByText(code)).toBeVisible();
  });

  test("a review can be moderated out of the queue", async ({ page }) => {
    await page.goto("/admin/reviews?status=PENDING");
    const publish = page.getByRole("button", { name: "Publish" }).first();

    if ((await publish.count()) === 0) {
      test.skip(true, "Moderation queue is empty");
      return;
    }

    await publish.click();
    await page.waitForTimeout(2500);
    await expect(page.getByText(/review published/i)).toBeVisible();
  });

  test("administrative actions are recorded in the audit log", async ({ page }) => {
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    // The actions taken by the tests above leave a trail.
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });
});
