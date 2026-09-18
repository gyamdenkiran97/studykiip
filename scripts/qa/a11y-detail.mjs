import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Prints the exact colour pairs axe objects to, so a contrast failure can be
 * fixed at the token rather than guessed at.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const storageState = process.env.STORAGE_STATE;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ...(storageState ? { storageState } : {}),
});
const page = await context.newPage();

for (const path of (process.env.PATHS ?? "/,/product/ashcroft-storm-overcoat,/sign-in,/contact").split(",")) {
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForTimeout(700);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();

  console.log(`\n=== ${path} (${results.violations.length} rule violations) ===`);
  for (const violation of results.violations) {
    console.log(`${violation.id} — ${violation.nodes.length} nodes`);
    const seen = new Map();
    for (const node of violation.nodes) {
      const message = node.any.map((check) => check.message).join(" ");
      const match = message.match(/foreground color: (#\w+), background color: (#\w+)/);
      const key = match ? `${match[1]} on ${match[2]}` : message.slice(0, 90);
      if (!seen.has(key)) seen.set(key, node.target[0]);
    }
    for (const [key, target] of seen) console.log("   ", key, "|", String(target).slice(0, 80));
  }
}

await browser.close();
