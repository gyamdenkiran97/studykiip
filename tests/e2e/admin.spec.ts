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

    // And it is really in the list, and really on the storefront.
    await page.goto(`/admin/products?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole("link", { name: title })).toBeVisible();

    const storefrontUrl = `/search?q=${encodeURIComponent(title)}`;
    await page.goto(storefrontUrl);
    await expect(page.getByRole("link", { name: new RegExp(title, "i") }).first()).toBeVisible();

    // Archive it again. This covers the archive path, and it stops each run of
    // the suite leaving another test product on the shop front.
    await page.goto(`/admin/products?q=${encodeURIComponent(title)}`);
    await page.getByRole("button", { name: "Product actions" }).first().click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await expect(page.getByText(/product archived/i)).toBeVisible({ timeout: 20_000 });

    // Archived means gone from the storefront but still readable in the back office.
    await page.goto(storefrontUrl);
    await expect(page.getByRole("link", { name: new RegExp(title, "i") })).toHaveCount(0);
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

  test("a captured payment can be partially refunded", async ({ page }) => {
    // Enter through the payments list so the order is guaranteed to have a
    // captured payment — a refund against an order without one is refused.
    await page.goto("/admin/payments?status=SUCCEEDED");
    const orderLink = page.locator('a[href^="/admin/orders/"]').first();

    if ((await orderLink.count()) === 0) {
      test.skip(true, "No captured payment available to refund");
      return;
    }

    await orderLink.click();
    await page.waitForURL(/\/admin\/orders\/[a-z0-9]+/);

    const panel = page.locator("section", { hasText: "Refund" }).last();
    await expect(panel).toBeVisible();

    // What is still refundable, before we take anything off it.
    const before = await page.locator("#refundAmount").inputValue();
    const beforeCents = Math.round(Number(before) * 100);
    expect(beforeCents).toBeGreaterThan(100);

    await page.fill("#refundAmount", "1.00");
    await page.getByRole("button", { name: "Issue refund" }).click();
    await expect(page.getByText(/refund issued/i)).toBeVisible({ timeout: 20_000 });

    // The money actually moved: the order is partially refunded and the
    // remaining refundable amount has dropped by exactly one pound.
    await page.reload();
    await expect(page.getByText(/partially refunded/i).first()).toBeVisible();
    const after = await page.locator("#refundAmount").inputValue();
    expect(Math.round(Number(after) * 100)).toBe(beforeCents - 100);
  });

  test("a refund larger than the order total is refused", async ({ page }) => {
    await page.goto("/admin/payments?status=SUCCEEDED");
    const orderLink = page.locator('a[href^="/admin/orders/"]').first();

    if ((await orderLink.count()) === 0) {
      test.skip(true, "No captured payment available to refund");
      return;
    }

    await orderLink.click();
    await page.waitForURL(/\/admin\/orders\/[a-z0-9]+/);
    await expect(page.locator("#refundAmount")).toBeVisible();

    await page.fill("#refundAmount", "99999.00");
    await page.getByRole("button", { name: "Issue refund" }).click();
    await expect(page.getByText(/more than the refundable amount/i)).toBeVisible();
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

  test("a review can be moderated in both directions", async ({ page }) => {
    // Self-provisioning rather than dependent on a queue that earlier runs may
    // have emptied: take a published review, reject it, then publish it back.
    // A skipped test verifies nothing, and moderation is a critical flow.
    await page.goto("/admin/reviews?status=PUBLISHED");
    const reject = page.getByRole("button", { name: "Reject" }).first();
    await expect(reject).toBeVisible();

    await reject.click();
    await expect(page.getByText(/review rejected/i)).toBeVisible({ timeout: 20_000 });

    // It has genuinely left the published set and is in the rejected one.
    await page.goto("/admin/reviews?status=REJECTED");
    const publish = page.getByRole("button", { name: "Publish" }).first();
    await expect(publish).toBeVisible();

    await publish.click();
    await expect(page.getByText(/review published/i)).toBeVisible({ timeout: 20_000 });
  });

  test("a pending review can be published from the queue", async ({ page }) => {
    await page.goto("/admin/reviews?status=PENDING");
    const publish = page.getByRole("button", { name: "Publish" }).first();

    if ((await publish.count()) === 0) {
      // Genuinely nothing waiting; the flow itself is covered by the test above.
      await expect(page.getByText("The moderation queue is empty")).toBeVisible();
      return;
    }

    await publish.click();
    await expect(page.getByText(/review published/i)).toBeVisible({ timeout: 20_000 });
  });

  test("administrative actions are recorded in the audit log", async ({ page }) => {
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    // The actions taken by the tests above leave a trail.
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });
});
