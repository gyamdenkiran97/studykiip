import { chromium } from "@playwright/test";

/**
 * QA screenshot helper. Uses the browser already present in this environment.
 * Usage: node scripts/qa/shot.mjs <path> <out.png> [width] [height] [fullPage]
 */
const [, , target = "/", out = "shot.png", width = "1440", height = "900", fullPage = "true"] = process.argv;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: 1,
});

const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

const base = process.env.BASE_URL ?? "http://localhost:3000";
const response = await page.goto(`${base}${target}`, { waitUntil: "networkidle", timeout: 60_000 });

// Scroll-triggered sections only reveal once observed, so walk the page before
// capturing it, then return to the top.
await page.evaluate(async () => {
  const step = window.innerHeight * 0.8;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1100);
await page.screenshot({ path: out, fullPage: fullPage === "true" });

const overflow = await page.evaluate(() => {
  const doc = document.documentElement;
  return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
});

console.log(
  JSON.stringify({
    status: response?.status(),
    out,
    horizontalOverflow: overflow.scrollWidth > overflow.clientWidth + 1 ? overflow : false,
    consoleErrors: errors.slice(0, 8),
  }),
);
await browser.close();
