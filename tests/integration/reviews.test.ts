import { describe, expect, it } from "vitest";
import { testDb } from "./helpers/setup";
import { createCustomer, createProduct, createWarehouse } from "./helpers/fixtures";
import { hasPurchased, listPublishedReviews, moderateReview, refreshProductRating } from "@/server/reviews";

/**
 * Verified-purchase status is derived from delivered orders rather than claimed
 * by the reviewer, and nothing appears on the storefront until a moderator
 * publishes it.
 */

async function orderContaining(userId: string, variantId: string, status: "DELIVERED" | "PENDING_PAYMENT") {
  return testDb.order.create({
    data: {
      orderNumber: `KM-REV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId,
      email: "buyer@example.test",
      status,
      currency: "GBP",
      subtotalCents: 1000,
      totalCents: 1000,
      items: {
        create: {
          variantId,
          productTitle: "Test",
          variantTitle: "Standard",
          sku: "TEST",
          quantity: 1,
          unitPriceCents: 1000,
          totalCents: 1000,
        },
      },
    },
  });
}

describe("reviews", () => {
  it("recognises a purchase only from an order that reached the customer", async () => {
    const warehouse = await createWarehouse();
    const { product, variant } = await createProduct({ warehouseId: warehouse.id });
    const buyer = await createCustomer();
    const browser = await createCustomer();

    await orderContaining(buyer.id, variant.id, "DELIVERED");
    await orderContaining(browser.id, variant.id, "PENDING_PAYMENT");

    expect(await hasPurchased(buyer.id, product.id)).toBe(true);
    // An unpaid order is not a purchase.
    expect(await hasPurchased(browser.id, product.id)).toBe(false);
  });

  it("enforces one review per customer per product at the database level", async () => {
    const warehouse = await createWarehouse();
    const { product } = await createProduct({ warehouseId: warehouse.id });
    const user = await createCustomer();

    await testDb.review.create({
      data: { productId: product.id, userId: user.id, rating: 5, body: "First review, long enough." },
    });

    await expect(
      testDb.review.create({
        data: { productId: product.id, userId: user.id, rating: 1, body: "Second review, also long enough." },
      }),
    ).rejects.toThrow();
  });

  it("rejects a rating outside one to five", async () => {
    const warehouse = await createWarehouse();
    const { product } = await createProduct({ warehouseId: warehouse.id });
    const user = await createCustomer();

    await expect(
      testDb.review.create({
        data: { productId: product.id, userId: user.id, rating: 6, body: "Out of range rating value." },
      }),
    ).rejects.toThrow();
  });

  it("hides unmoderated reviews and counts only published ones", async () => {
    const warehouse = await createWarehouse();
    const { product } = await createProduct({ warehouseId: warehouse.id });
    const [one, two] = await Promise.all([createCustomer(), createCustomer()]);

    const pending = await testDb.review.create({
      data: { productId: product.id, userId: one.id, rating: 5, body: "Pending review, long enough." },
    });
    await testDb.review.create({
      data: {
        productId: product.id,
        userId: two.id,
        rating: 3,
        body: "Published review, long enough.",
        status: "PUBLISHED",
      },
    });

    await refreshProductRating(product.id);

    const before = await listPublishedReviews(product.id);
    expect(before.total).toBe(1);

    const productBefore = await testDb.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(productBefore.ratingCount).toBe(1);
    expect(productBefore.ratingAverageBps).toBe(300);

    // Publishing the second review updates the aggregate the cards read.
    await moderateReview(pending.id, "PUBLISHED");

    const after = await listPublishedReviews(product.id);
    expect(after.total).toBe(2);

    const productAfter = await testDb.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(productAfter.ratingCount).toBe(2);
    expect(productAfter.ratingAverageBps).toBe(400);
  });

  it("shortens author names so a review does not publish a full identity", async () => {
    const warehouse = await createWarehouse();
    const { product } = await createProduct({ warehouseId: warehouse.id });
    const user = await createCustomer({ name: "Aoife Brennan" });

    await testDb.review.create({
      data: {
        productId: product.id,
        userId: user.id,
        rating: 4,
        body: "A perfectly reasonable review body.",
        status: "PUBLISHED",
      },
    });

    const { reviews } = await listPublishedReviews(product.id);
    expect(reviews[0].authorName).toBe("Aoife B.");
  });
});
