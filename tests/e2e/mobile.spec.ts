import { expect, test } from "@playwright/test";

/**
 * Mobile is a first-class layout here, not a shrunken desktop: a separate
 * drawer navigation, a persistent bottom bar and a filter sheet. These run on
 * a real mobile viewport with touch enabled.
 */
test.describe("mobile", () => {
  test("the bottom bar keeps the key actions within reach", async ({ page }) => {
    await page.goto("/");
    const bar = page.getByRole("navigation", { name: "Quick actions" });
    await expect(bar).toBeVisible();

    for (const label of ["Home", "Search", "Saved", "Basket", "Account"]) {
      await expect(bar.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("the menu drawer opens and expands a department", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Fashion" })).toBeVisible();

    await dialog.getByRole("button", { name: /expand fashion/i }).click();
    await expect(dialog.getByRole("link", { name: "Outerwear" })).toBeVisible();
  });

  test("the filter sheet opens from a collection page", async ({ page }) => {
    await page.goto("/category/fashion");
    await page.getByRole("button", { name: /^Filter/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Filter" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Show results" })).toBeVisible();
  });

  test("no page scrolls sideways at 393px", async ({ page }) => {
    for (const path of ["/", "/shop", "/category/fashion", "/product/ashcroft-storm-overcoat", "/cart"]) {
      await page.goto(path);
      await page.waitForTimeout(500);

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflows, `${path} overflows horizontally`).toBe(false);
    }
  });

  test("a product can be added to the basket on a phone", async ({ page }) => {
    await page.goto("/product/verdant-house-espresso");
    await page.getByRole("button", { name: "Add to basket" }).click();
    await page.waitForTimeout(2500);

    // Adding from a product page confirms with a toast and updates the count in
    // the bottom bar, rather than covering the page with the drawer.
    await expect(page.getByText(/added to your basket/i)).toBeVisible();
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
    await expect(page.getByText("House Espresso 250g").first()).toBeVisible();
  });

  test("tap targets in the bottom bar are large enough", async ({ page }) => {
    await page.goto("/");
    const links = page.getByRole("navigation", { name: "Quick actions" }).locator("a, button");

    for (let index = 0; index < (await links.count()); index += 1) {
      const box = await links.nth(index).boundingBox();
      // WCAG 2.2 target size (minimum) is 24px; we aim well above it.
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(36);
    }
  });
});
