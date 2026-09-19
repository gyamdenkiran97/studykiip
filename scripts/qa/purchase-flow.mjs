import { chromium } from "@playwright/test";

/** Drives a complete purchase as a signed-in customer and reports each step. */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT_DIR ?? "/tmp";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160)); });

const steps = [];
const step = (name, detail) => { steps.push(`${name}: ${detail}`); console.log(`  ${name} — ${detail}`); };

try {
  // 1. Sign in
  await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
  await page.fill("#email", "customer@kwidus21.test");
  await page.fill("#password", "DemoCustomer!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/account/, { timeout: 20000 });
  step("sign-in", "ok");

  // 2. Product, pick a variant, add to basket
  await page.goto(`${BASE}/product/fenwick-lambswool-crew`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Forest" }).click();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.waitForTimeout(400);
  const sku = (await page.locator("text=/^SKU /").first().textContent())?.trim();
  await page.getByRole("button", { name: "Add to basket" }).click();
  await page.waitForTimeout(1500);
  step("add-to-cart", sku ?? "added");

  // 3. Cart, apply a coupon
  await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
  await page.fill("#coupon", "WELCOME10");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForTimeout(1800);
  const discountVisible = await page.locator("text=Discount").count();
  await page.screenshot({ path: `${OUT}/flow-cart.png` });
  step("coupon", discountVisible > 0 ? "applied" : "NOT applied");

  // 4. Checkout
  await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const continueDelivery = page.getByRole("button", { name: "Continue to delivery" });
  if (await continueDelivery.count()) await continueDelivery.click();
  await page.waitForTimeout(500);
  const continuePayment = page.getByRole("button", { name: "Continue to payment" });
  if (await continuePayment.count()) await continuePayment.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/flow-checkout.png` });
  step("checkout-steps", "reached payment");

  // 5. Place order
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForTimeout(3000);
  const sandbox = await page.locator("text=Sandbox payment").count();
  step("place-order", sandbox > 0 ? "order created, payment panel shown" : "payment panel MISSING");
  await page.screenshot({ path: `${OUT}/flow-payment.png` });

  // 6. Pay
  await page.getByRole("button", { name: /^Pay / }).click();
  await page.waitForURL(/\/order\/success/, { timeout: 25000 });
  await page.waitForTimeout(2500);
  const heading = (await page.locator("h1").first().textContent())?.trim();
  await page.screenshot({ path: `${OUT}/flow-success.png` });
  step("payment", heading ?? "");

  // 7. Order history
  await page.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
  const orderRows = await page.locator("text=/KM-/").count();
  step("order-history", `${orderRows} order(s) listed`);

  const firstOrder = page.getByRole("link", { name: "View order" }).first();
  await firstOrder.click();
  await page.waitForTimeout(1500);
  const status = (await page.locator("main").innerText()).match(/Paid|Processing|Awaiting payment/)?.[0];
  await page.screenshot({ path: `${OUT}/flow-order.png`, fullPage: true });
  step("order-detail", `status ${status}`);
} catch (error) {
  console.log("  FAILED:", error.message.split("\n")[0]);
  await page.screenshot({ path: `${OUT}/flow-failure.png` });
  process.exitCode = 1;
} finally {
  console.log("\nconsole errors:", errors.slice(0, 5));
  await browser.close();
}
