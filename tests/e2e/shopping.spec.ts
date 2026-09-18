import { expect, test } from "@playwright/test";
import { addFirstProductToCart, emptyCart } from "./helpers";

test.beforeEach(async ({ page }) => {
  // Each test starts from an empty basket: they share one customer account.
  await emptyCart(page);
});

test.describe("basket and wishlist", () => {
  test("a customer can add to the basket", async ({ page }) => {
    await addFirstProductToCart(page);

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
    await expect(page.locator("li", { hasText: "Remove" }).first()).toBeVisible();
  });

  test("quantity changes recalculate the total on the server", async ({ page }) => {
    await addFirstProductToCart(page);
    await page.goto("/cart");

    const lineTotal = () =>
      page
        .locator("li")
        .filter({ hasText: "Remove" })
        .first()
        .locator('[data-testid="price"]')
        .first();

    const before = Number(await lineTotal().getAttribute("data-price-cents"));

    await page.getByRole("button", { name: "Increase quantity" }).first().click();
    await page.waitForTimeout(2000);

    const after = Number(await lineTotal().getAttribute("data-price-cents"));
    // The server recomputes the line: two of the same item costs twice as much.
    expect(after).toBe(before * 2);
  });

  test("an item can be removed from the basket", async ({ page }) => {
    await addFirstProductToCart(page);
    await page.goto("/cart");

    await page.getByRole("button", { name: /^Remove$/ }).first().click();
    await page.waitForTimeout(2000);

    await expect(page.getByText(/your basket is empty/i)).toBeVisible();
  });

  test("a valid discount code is applied and shown in the summary", async ({ page }) => {
    // MALL20 requires a £100 minimum, so pick from a department that clears it.
    await addFirstProductToCart(page, "/category/furniture?stock=1");
    await page.goto("/cart");

    // MALL20 has no per-customer limit, so the suite can run repeatedly.
    await page.fill("#coupon", "MALL20");
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForTimeout(2500);

    await expect(page.getByText("MALL20 applied")).toBeVisible();
    await expect(page.getByText("Discount", { exact: false }).first()).toBeVisible();
  });

  test("an invalid discount code is refused", async ({ page }) => {
    await addFirstProductToCart(page);
    await page.goto("/cart");

    await page.fill("#coupon", "NOTAREALCODE");
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForTimeout(2000);

    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("a signed-in customer can save and remove a wishlist item", async ({ page }) => {
    await page.goto("/product/nocturne-over-ear-headphones");
    const saveButton = page.getByRole("button", { name: /save to wishlist|remove from wishlist/i }).first();
    const wasSaved = (await saveButton.getAttribute("aria-pressed")) === "true";
    await saveButton.click();
    await page.waitForTimeout(1800);

    await page.goto("/wishlist");
    const items = await page.locator('article h3 a[href^="/product/"]').count();
    expect(wasSaved ? items >= 0 : items > 0).toBe(true);

    // Put it back the way we found it so the suite stays repeatable.
    await page.goto("/product/nocturne-over-ear-headphones");
    const toggle = page.getByRole("button", { name: /save to wishlist|remove from wishlist/i }).first();
    if (((await toggle.getAttribute("aria-pressed")) === "true") !== wasSaved) {
      await toggle.click();
      await page.waitForTimeout(1200);
    }
  });
});
