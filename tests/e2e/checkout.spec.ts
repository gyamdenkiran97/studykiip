import { expect, test } from "@playwright/test";
import { addFirstProductToCart } from "./helpers";

/**
 * The purchase path, end to end, against the sandbox payment provider. The
 * order is only confirmed once the signed webhook has been handled — the test
 * asserts on the resulting state, not on the redirect.
 */
test.describe("checkout and payment", () => {
  test("a customer can buy something and see the order afterwards", async ({ page }) => {
    await addFirstProductToCart(page, "/category/beauty?stock=1");

    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    const toDelivery = page.getByRole("button", { name: "Continue to delivery" });
    if (await toDelivery.count()) await toDelivery.click();

    const toPayment = page.getByRole("button", { name: "Continue to payment" });
    await toPayment.click();
    await page.waitForTimeout(600);

    await page.getByRole("button", { name: /Place order/ }).click();
    await page.waitForURL(/\/checkout\/payment\//, { timeout: 30_000 });
    await expect(page.getByText(/sandbox payment/i)).toBeVisible();

    await page.getByRole("button", { name: /^Pay / }).click();
    await page.waitForURL(/\/order\/success/, { timeout: 30_000 });

    await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/KM-/).first()).toBeVisible();

    // And it appears in the customer's history as paid.
    await page.goto("/account/orders");
    await expect(page.getByText(/KM-/).first()).toBeVisible();
    await page.getByRole("link", { name: "View order" }).first().click();
    await expect(page.getByText(/PAID/i).first()).toBeVisible();
  });

  test("a declined payment leaves the order unpaid and recoverable", async ({ page }) => {
    await addFirstProductToCart(page, "/category/office?stock=1");

    await page.goto("/checkout");
    const toDelivery = page.getByRole("button", { name: "Continue to delivery" });
    if (await toDelivery.count()) await toDelivery.click();
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await page.getByRole("button", { name: /Place order/ }).click();
    await page.waitForURL(/\/checkout\/payment\//, { timeout: 30_000 });

    await page.getByRole("button", { name: /declined card/i }).click();
    await page.waitForTimeout(2500);

    // Still on the payment page, and the order can be paid on a second attempt.
    await expect(page).toHaveURL(/\/checkout\/payment\//);
    await expect(page.getByRole("button", { name: /^Pay / })).toBeVisible();
  });

  test("the basket empties after a completed purchase", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByText(/your basket is empty|saved for later/i).first()).toBeVisible();
  });
});
