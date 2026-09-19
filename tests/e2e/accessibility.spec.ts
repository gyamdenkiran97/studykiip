import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automated accessibility checks.
 *
 * Axe catches roughly a third of real WCAG problems — it is a floor, not a
 * ceiling. The keyboard, focus and motion behaviours it cannot see are covered
 * by the interaction tests below it.
 *
 * The scans run in a reduced-motion context. That is not to hide anything: with
 * animation disabled, content is rendered in its final state, so axe measures
 * the colours the design actually ships rather than a half-faded frame of a
 * reveal transition. It is also precisely the rendering a motion-sensitive
 * visitor receives, which makes it the more important one to get right.
 */

const PAGES = [
  { path: "/", name: "homepage" },
  { path: "/shop", name: "collection" },
  { path: "/product/ashcroft-storm-overcoat", name: "product" },
  { path: "/cart", name: "basket" },
  { path: "/sign-in", name: "sign in" },
  { path: "/faq", name: "faq" },
  { path: "/contact", name: "contact" },
  { path: "/returns", name: "returns policy" },
];

for (const target of PAGES) {
  test(`${target.name} has no detectable WCAG A/AA violations`, async ({ browser }) => {
    // storageState: undefined is required — a context created inside a test
    // otherwise inherits the project's stored session, and /sign-in would
    // redirect to the account area instead of rendering the form.
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
      storageState: undefined,
    });
    const page = await context.newPage();

    await page.goto(target.path);
    await page.waitForTimeout(700);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    // Report what failed, not just how many.
    const summary = results.violations.flatMap((violation) =>
      violation.nodes.slice(0, 3).map((node) => `${violation.id} (${violation.impact}): ${node.target[0]}`),
    );
    expect(summary, summary.join("\n")).toEqual([]);

    await context.close();
  });
}

test("the admin dashboard has no detectable WCAG A/AA violations", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    storageState: "tests/e2e/.auth/admin.json",
  });
  const page = await context.newPage();

  await page.goto("/admin");
  await page.waitForTimeout(700);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  const summary = results.violations.flatMap((violation) =>
    violation.nodes.slice(0, 3).map((node) => `${violation.id} (${violation.impact}): ${node.target[0]}`),
  );
  expect(summary, summary.join("\n")).toEqual([]);

  await context.close();
});

test("the header is reachable and operable by keyboard", async ({ page }) => {
  await page.goto("/");

  // The skip link is the first stop.
  await page.keyboard.press("Tab");
  await expect(page.locator("a", { hasText: "Skip to content" })).toBeFocused();

  // Focusing a department opens its panel without a mouse.
  const fashion = page.getByRole("button", { name: "Fashion" });
  await fashion.focus();
  await expect(fashion).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Outerwear" })).toBeVisible();

  // Escape closes it.
  await page.keyboard.press("Escape");
  await expect(fashion).toHaveAttribute("aria-expanded", "false");
});

test("the basket drawer moves focus into itself and closes on Escape", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Basket/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(":focus")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("a keyboard-focused control is never hidden behind the sticky header", async ({ browser }) => {
  // WCAG 2.2 AA, 2.4.11 Focus Not Obscured. axe cannot see this: the element
  // is perfectly visible in the DOM, it is simply underneath a sticky bar.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: undefined });
  const page = await context.newPage();

  await page.goto("/shop");
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(400);

  const headerBottom = await page.evaluate(() => {
    const header = document.querySelector("header.sticky") ?? document.querySelector("header");
    return header ? header.getBoundingClientRect().bottom : 0;
  });
  expect(headerBottom).toBeGreaterThan(0);

  // Walk the tab order and check each stop that lands inside the viewport.
  const obscured: string[] = [];
  for (let step = 0; step < 25; step += 1) {
    await page.keyboard.press("Tab");
    const found = await page.evaluate((limit) => {
      const node = document.activeElement as HTMLElement | null;
      if (!node || node === document.body) return null;

      // A control inside the sticky bar is not obscured by it — it is part of
      // it. Only content that scrolls underneath can be hidden.
      for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
        const position = getComputedStyle(parent).position;
        if (position === "sticky" || position === "fixed") return null;
      }

      const box = node.getBoundingClientRect();
      if (box.height === 0 || box.bottom < 0 || box.top > window.innerHeight) return null;
      // Only a control whose top edge is under the header is actually hidden.
      if (box.top >= limit || box.bottom <= 0) return null;
      const label = (node.getAttribute("aria-label") ?? node.textContent ?? node.tagName).trim().slice(0, 40);
      return `${node.tagName.toLowerCase()} "${label}" top=${Math.round(box.top)} < header ${Math.round(limit)}`;
    }, headerBottom);
    if (found) obscured.push(found);
  }

  expect(obscured, obscured.join("\n")).toEqual([]);
  await context.close();
});

test("every image carries alt text", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.locator("img:not([alt])")).toHaveCount(0);
});

test("a form error is announced rather than only coloured", async ({ browser }) => {
  // Signed out: a signed-in session is redirected away from /sign-in.
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();

  await page.goto("/sign-in");
  await page.fill("#email", "someone@example.test");
  await page.fill("#password", "wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(2000);

  const error = page.locator("#form-error");
  await expect(error).toBeVisible();
  await expect(error).toHaveAttribute("role", "alert");
  await expect(page.locator("#email")).toHaveAttribute("aria-describedby", "form-error");

  await context.close();
});

test("reduced motion is honoured", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", storageState: undefined });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForTimeout(500);

  // Sections below the fold are visible immediately rather than waiting for a
  // reveal that will never run.
  const heading = page.getByRole("heading", { name: /find your floor/i });
  await expect(heading).toBeVisible();
  const opacity = await heading.evaluate((node) => getComputedStyle(node.parentElement!).opacity);
  expect(Number(opacity)).toBeGreaterThan(0.9);

  await context.close();
});
