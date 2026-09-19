import type { Page } from "@playwright/test";

/** Shared credentials and helpers for the end-to-end suite. */

export const CUSTOMER = {
  email: process.env.SEED_CUSTOMER_EMAIL ?? "customer@kwidus21.test",
  password: process.env.SEED_CUSTOMER_PASSWORD ?? "DemoCustomer!2026",
};

export const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? "admin@kwidus21.test",
  password: process.env.SEED_ADMIN_PASSWORD ?? "DemoAdmin!2026",
};

export async function signIn(page: Page, who: { email: string; password: string }): Promise<void> {
  await page.goto("/sign-in");
  await page.fill("#email", who.email);
  await page.fill("#password", who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 30_000 });
}

export async function signOut(page: Page): Promise<void> {
  await page.goto("/account");
  const button = page.getByRole("button", { name: "Sign out" });
  if (await button.count()) {
    await button.first().click();
    await page.waitForTimeout(1200);
  }
}

/** Registers a throwaway account and returns its credentials. */
export function uniqueAccount() {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    name: "Test Person",
    email: `e2e-${stamp}@kwidus21.test`,
    password: "an adequately long passphrase",
  };
}

/** Adds the first in-stock product on a collection page to the basket. */
export async function addFirstProductToCart(page: Page, collectionPath = "/shop?stock=1"): Promise<string> {
  await page.goto(collectionPath);
  const firstProduct = page.locator('article h3 a[href^="/product/"]').first();
  const href = await firstProduct.getAttribute("href");
  await firstProduct.click();
  await page.waitForURL(/\/product\//);

  const addButton = page.getByRole("button", { name: "Add to basket" });
  await addButton.click();
  await page.waitForTimeout(1500);

  return href ?? "";
}

/** Empties the basket so a test starts from a known state. */
export async function emptyCart(page: Page): Promise<void> {
  await page.goto("/cart");
  for (let guard = 0; guard < 12; guard += 1) {
    const remove = page.getByRole("button", { name: /^Remove$/ });
    if ((await remove.count()) === 0) return;
    await remove.first().click();
    await page.waitForTimeout(900);
  }
}
