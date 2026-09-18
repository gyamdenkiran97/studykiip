import { expect, test as setup } from "@playwright/test";
import { ADMIN, CUSTOMER } from "./helpers";

/**
 * Signs in once per run and stores the session for the other specs.
 *
 * Besides being faster, this keeps the suite inside the sign-in rate limit —
 * which is deliberately strict, and which the auth spec tests on purpose.
 */

// Paths are relative to the project root, matching playwright.config.ts.
export const CUSTOMER_STATE = "tests/e2e/.auth/customer.json";
export const ADMIN_STATE = "tests/e2e/.auth/admin.json";

setup("authenticate as customer", async ({ page }) => {
  await page.goto("/sign-in");
  await page.fill("#email", CUSTOMER.email);
  await page.fill("#password", CUSTOMER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 30_000 });

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.context().storageState({ path: CUSTOMER_STATE });
});

setup("authenticate as administrator", async ({ page }) => {
  await page.goto("/sign-in");
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 30_000 });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});
