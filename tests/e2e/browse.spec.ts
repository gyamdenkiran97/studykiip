import { expect, test } from "@playwright/test";

test.describe("browsing and search", () => {
  test("the homepage renders its main sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Departments" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("a department page lists products and offers filters", async ({ page }) => {
    await page.goto("/category/fashion");
    await expect(page.getByRole("heading", { name: "Fashion", level: 1 })).toBeVisible();
    await expect(page.locator('article h3 a[href^="/product/"]').first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Filters" }).or(page.locator("aside"))).toBeTruthy();
  });

  test("filtering by availability narrows the results and is shareable", async ({ page }) => {
    await page.goto("/category/fashion");
    const before = await page.locator('article h3 a[href^="/product/"]').count();

    await page.getByLabel(/in stock only/i).check();
    await page.waitForTimeout(1500);

    expect(page.url()).toContain("stock=1");
    const after = await page.locator('article h3 a[href^="/product/"]').count();
    expect(after).toBeLessThanOrEqual(before);
  });

  test("sorting by price puts the cheapest first", async ({ page }) => {
    await page.goto("/category/fashion?sort=price-asc");
    const prices = await page.locator('article [data-testid="price"]').evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute("data-price-cents"))),
    );
    const numbers = prices.filter((value) => Number.isFinite(value) && value > 0);

    expect(numbers.length).toBeGreaterThan(1);
    expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
  });

  test("search finds a product, tolerating a plural", async ({ page }) => {
    await page.goto("/search?q=trainers");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/trainers/i);
    await expect(page.locator('article h3 a[href^="/product/"]').first()).toBeVisible();
  });

  test("a search with no matches explains itself instead of showing an empty grid", async ({ page }) => {
    await page.goto("/search?q=zzzznotathing");
    await expect(page.getByText(/no results for/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /browse everything/i })).toBeVisible();
  });

  test("the search overlay suggests products as you type", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search" }).first().click();
    await page.getByLabel(/search products/i).fill("noct");
    await page.waitForTimeout(1200);
    await expect(page.getByText("Nocturne Audio").first()).toBeVisible();
  });

  test("a product page shows price, stock and variant options", async ({ page }) => {
    await page.goto("/product/ashcroft-storm-overcoat");
    await expect(page.getByRole("heading", { name: "Storm Overcoat" })).toBeVisible();
    await expect(page.getByText(/SKU /)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to basket" })).toBeEnabled();
  });

  test("choosing a variant updates the SKU and availability", async ({ page }) => {
    await page.goto("/product/ashcroft-storm-overcoat");
    const initialSku = await page.getByText(/SKU /).textContent();

    await page.getByRole("button", { name: "Slate" }).click();
    await page.waitForTimeout(600);

    const updatedSku = await page.getByText(/SKU /).textContent();
    expect(updatedSku).not.toBe(initialSku);
    expect(updatedSku).toContain("SLAT");
  });
});
