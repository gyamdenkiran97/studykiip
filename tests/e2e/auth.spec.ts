import { expect, test } from "@playwright/test";
import { CUSTOMER, signIn, uniqueAccount } from "./helpers";

test.describe("authentication", () => {
  test("a visitor can register an account", async ({ page }) => {
    const account = uniqueAccount();

    await page.goto("/sign-up");
    await page.fill("#name", account.name);
    await page.fill("#email", account.email);
    await page.fill("#password", account.password);
    await page.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL(/\/account/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("a registered customer can sign in", async ({ page }) => {
    await signIn(page, CUSTOMER);
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("a wrong password is refused with a message that names neither field", async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill("#email", CUSTOMER.email);
    await page.fill("#password", "definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    const alert = page.locator("#form-error");
    await expect(alert).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);

    // Whether it is the generic failure or the rate limiter, the message must
    // never say which of the two fields was wrong.
    const message = (await alert.textContent()) ?? "";
    expect(message).not.toMatch(/incorrect password|no such (user|account)|email not found/i);
  });

  test("an unknown address and a wrong password are indistinguishable", async ({ request }) => {
    const attempt = (email: string) =>
      request.post("/api/auth/sign-in/email", {
        data: { email, password: "definitely-not-the-password" },
        failOnStatusCode: false,
      });

    const [known, unknown] = await Promise.all([
      attempt(CUSTOMER.email),
      attempt(`nobody-${Date.now()}@kiipmall.test`),
    ]);

    // Identical status and body: the endpoint cannot be used to discover which
    // addresses have accounts.
    expect(known.status()).toBe(unknown.status());
    expect(await known.text()).toBe(await unknown.text());
  });

  test("the password reset form never confirms whether an address exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.fill("#email", "definitely-not-a-customer@example.test");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByRole("status")).toContainText(/if that address has an account/i);
  });

  test("a signed-out visitor is sent to sign in before checkout", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/checkout");
  });

  test("the wishlist asks a signed-out visitor to sign in", async ({ page }) => {
    await page.goto("/wishlist");
    await expect(page.getByRole("heading", { name: "Your wishlist" })).toBeVisible();
    // Scoped to the page body: the header's account icon is also labelled "Sign in".
    await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("an open redirect in the next parameter is ignored", async ({ page }, testInfo) => {
    await page.goto("/sign-in?next=https://example.com/phishing");
    await page.fill("#email", CUSTOMER.email);
    await page.fill("#password", CUSTOMER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForTimeout(2500);

    // Whatever the parameter said, we stay on our own origin.
    const expectedHost = new URL(testInfo.project.use.baseURL ?? "http://localhost:3000").host;
    expect(new URL(page.url()).host).toBe(expectedHost);
  });
});
