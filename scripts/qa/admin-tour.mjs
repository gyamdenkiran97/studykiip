import { chromium } from "@playwright/test";

/** Signs in as the demo administrator and visits every admin screen. */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT_DIR ?? "/tmp";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const problems = [];
page.on("pageerror", (error) => problems.push(`pageerror: ${error.message.slice(0, 140)}`));

await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
await page.fill("#email", "admin@kwidus21.test");
await page.fill("#password", "DemoAdmin!2026");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForTimeout(3000);

const routes = [
  "/admin",
  "/admin/orders",
  "/admin/products",
  "/admin/products/new",
  "/admin/categories",
  "/admin/brands",
  "/admin/inventory",
  "/admin/reviews",
  "/admin/customers",
  "/admin/payments",
  "/admin/promotions",
  "/admin/content",
  "/admin/search",
  "/admin/settings",
  "/admin/audit",
];

for (const route of routes) {
  const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(350);
  const status = response?.status();
  const heading = (await page.locator("h1").first().textContent().catch(() => null))?.trim();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  const ok = status === 200 && heading;
  console.log(`  ${ok ? "ok " : "!! "} ${route.padEnd(24)} ${status} ${heading ?? "(no h1)"}${overflow ? " [OVERFLOW]" : ""}`);
  if (!ok) problems.push(`${route} → ${status}`);
  if (route === "/admin" || route === "/admin/orders" || route === "/admin/products") {
    await page.screenshot({ path: `${OUT}/admin-${route.split("/").pop() || "dashboard"}.png` });
  }
}

// Order detail and invoice, reached through the list.
await page.goto(`${BASE}/admin/orders`, { waitUntil: "networkidle" });
const firstOrder = page.locator('a[href^="/admin/orders/"]').first();
if (await firstOrder.count()) {
  const href = await firstOrder.getAttribute("href");
  await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
  console.log(`  ok  order detail            ${(await page.locator("h1").first().textContent())?.trim()}`);
  await page.screenshot({ path: `${OUT}/admin-order.png`, fullPage: true });
  await page.goto(`${BASE}${href}/invoice`, { waitUntil: "networkidle" });
  console.log(`  ok  invoice                 ${(await page.locator("h1").first().textContent())?.trim()}`);
  await page.screenshot({ path: `${OUT}/admin-invoice.png` });
}

console.log("\nproblems:", problems.length ? problems : "none");
await browser.close();
