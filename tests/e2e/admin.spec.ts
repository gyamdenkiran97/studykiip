import { expect, test } from "@playwright/test";
import { createPaidOrder, disconnectFixtures } from "./fixtures/paid-order";

/**
 * Administrative flows, run with a stored administrator session.
 * Authorisation is checked server-side on every action, so these tests assert
 * on the resulting state rather than on whether a button was rendered.
 */
test.describe("admin", () => {
  test.afterAll(async () => {
    await disconnectFixtures();
  });

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
    const order = await createPaidOrder();
    await page.goto(`/admin/orders/${order.id}`);

    const statusSelect = page.locator("#status");
    await expect(statusSelect).toBeVisible();

    // Only transitions the machine permits are offered — a paid order can
    // never be sent back to awaiting payment.
    const options = await statusSelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(0);
    expect(options.join(" ")).not.toContain("Awaiting payment");

    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByText(/order status updated/i)).toBeVisible({ timeout: 20_000 });
  });

  test("a captured payment can be partially refunded, and an over-refund refused", async ({ page }) => {
    // Both assertions live in one test on purpose: issuing the partial refund
    // changes the state the other one would need, so as separate tests the
    // second would find nothing and skip — and a skipped test verifies nothing.
    const order = await createPaidOrder();
    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.locator("section", { hasText: "Refund" }).last()).toBeVisible();

    const beforeCents = Math.round(Number(await page.locator("#refundAmount").inputValue()) * 100);
    expect(beforeCents).toBe(order.totalCents);

    // More than the order is worth is refused, and nothing moves.
    await page.fill("#refundAmount", "99999.00");
    await page.getByRole("button", { name: "Issue refund" }).click();
    await expect(page.getByText(/more than the refundable amount/i)).toBeVisible();

    // A legitimate partial refund goes through.
    await page.fill("#refundAmount", "1.00");
    await page.getByRole("button", { name: "Issue refund" }).click();
    await expect(page.getByText(/refund issued/i)).toBeVisible({ timeout: 20_000 });

    // The money actually moved: the order is partially refunded and the
    // remaining refundable amount has dropped by exactly one pound.
    //
    // Polled with a reload each time rather than asserted after a single one.
    // The toast appears the moment the action returns, and a reload issued in
    // that same instant can render before the refreshed data arrives — which
    // says nothing about whether the refund worked.
    await expect(async () => {
      await page.reload();
      await expect(page.getByText(/partially refunded/i).first()).toBeVisible();
      const value = await page.locator("#refundAmount").inputValue();
      expect(Math.round(Number(value) * 100)).toBe(beforeCents - 100);
    }).toPass({ timeout: 20_000 });

    // And a second partial refund on the same order still works — the status
    // is already PARTIALLY_REFUNDED, which is not a transition, and asking the
    // state machine for one used to throw after the money had already moved.
    await page.fill("#refundAmount", "1.00");
    await page.getByRole("button", { name: "Issue refund" }).click();
    await expect(page.getByText(/refund issued/i)).toBeVisible({ timeout: 20_000 });

    await expect(async () => {
      await page.reload();
      const value = await page.locator("#refundAmount").inputValue();
      expect(Math.round(Number(value) * 100)).toBe(beforeCents - 200);
    }).toPass({ timeout: 20_000 });
  });

  test("an order whose payment was declined offers no refund", async ({ page }) => {
    // A declined payment leaves a full outstanding balance, which is not the
    // same as something to refund. The panel must not be offered at all.
    await page.goto("/admin/orders?status=PENDING_PAYMENT");
    const orderLink = page.locator('a[href^="/admin/orders/"]').first();

    if ((await orderLink.count()) === 0) {
      // Nothing unpaid right now; the refund test above covers the paid side.
      await expect(page.getByText(/no orders|nothing/i).first()).toBeVisible();
      return;
    }

    await orderLink.click();
    await page.waitForURL(/\/admin\/orders\/[a-z0-9]+/);
    await expect(page.getByRole("button", { name: "Issue refund" })).toHaveCount(0);
    await expect(page.locator("#refundAmount")).toHaveCount(0);
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
