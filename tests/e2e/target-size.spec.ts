import { expect, test } from "@playwright/test";

/**
 * WCAG 2.2 AA — 2.5.8 Target Size (Minimum).
 *
 * Pointer targets must be at least 24×24 CSS pixels unless an exception
 * applies. axe does not report this as a violation, so it is measured here.
 *
 * This checks **controls with no visible text** — icon buttons, swatches,
 * carousel dots, steppers. Those have no natural size and no exception to fall
 * back on, so a small one is simply a small one, and they are where real
 * violations live.
 *
 * Text links are deliberately not checked. A link sized by its own line-height
 * is what the *inline* exception describes, and a product title beside a large
 * image link to the same page is covered by the *equivalent control*
 * exception. Flagging every title in a grid would produce dozens of findings
 * nobody can act on, and a test that cries wolf is a test that gets deleted.
 *
 * Also skipped: native controls the browser sizes itself (select, checkbox,
 * radio — the *user agent* exception), and visually hidden elements such as the
 * skip link, which is 1×1 until focus makes it full size.
 */

const PAGES = [
  { path: "/", name: "homepage" },
  { path: "/shop", name: "collection" },
  { path: "/product/ashcroft-storm-overcoat", name: "product" },
  { path: "/cart", name: "basket" },
  { path: "/sign-in", name: "sign in" },
];

const MIN = 24;

type Offender = { tag: string; label: string; width: number; height: number };

async function undersizedTargets(page: import("@playwright/test").Page): Promise<Offender[]> {
  return page.evaluate((min) => {
    const selector = 'a[href], button, input:not([type="hidden"]), [role="button"], [role="tab"], summary';
    const results: Offender[] = [];

    for (const element of Array.from(document.querySelectorAll(selector))) {
      const node = element as HTMLElement;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") continue;

      const box = node.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue; // not a target

      // Visually hidden (the skip link, screen-reader-only text): clipped to a
      // pixel until focused, at which point it is sized normally.
      if (box.width <= 1 || box.height <= 1) continue;

      // User agent exception: controls the browser sizes itself.
      if (node.tagName === "SELECT") continue;
      if (node.tagName === "INPUT" && ["checkbox", "radio"].includes((node as HTMLInputElement).type)) continue;

      // Only controls with no visible text. A control labelled by visible text
      // is sized by that text — see the note above.
      const visibleText = (node.innerText ?? node.textContent ?? "").trim();
      if (visibleText.length > 0) continue;

      if (box.width < min || box.height < min) {
        results.push({
          tag: node.tagName.toLowerCase(),
          label: node.getAttribute("aria-label") ?? node.getAttribute("title") ?? node.className.slice(0, 50),
          width: Math.round(box.width),
          height: Math.round(box.height),
        });
      }
    }
    return results;
  }, MIN);
}

for (const target of PAGES) {
  test(`${target.name}: icon-only controls are at least 24x24 on desktop`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: undefined });
    const page = await context.newPage();
    await page.goto(target.path);
    await page.waitForTimeout(400);

    const offenders = await undersizedTargets(page);
    const report = offenders.map((o) => `${o.tag} "${o.label}" is ${o.width}x${o.height}`);
    expect(report, report.join("\n")).toEqual([]);

    await context.close();
  });

  test(`${target.name}: icon-only controls are at least 24x24 on a phone`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      storageState: undefined,
    });
    const page = await context.newPage();
    await page.goto(target.path);
    await page.waitForTimeout(400);

    const offenders = await undersizedTargets(page);
    const report = offenders.map((o) => `${o.tag} "${o.label}" is ${o.width}x${o.height}`);
    expect(report, report.join("\n")).toEqual([]);

    await context.close();
  });
}
