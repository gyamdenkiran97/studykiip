import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "./helpers/setup";
import { createCustomer, createProduct, createWarehouse } from "./helpers/fixtures";
import { mergeCarts } from "@/server/cart";

/**
 * Signing in must not lose a basket.
 *
 * A visitor who fills a basket, then registers or signs in, keeps what they
 * picked. The anonymous cart is merged into the account's cart rather than
 * either one silently winning.
 */

async function createCart(options: { userId?: string; token?: string } = {}) {
  return testDb.cart.create({
    data: {
      token: options.token ?? randomUUID(),
      userId: options.userId ?? null,
      currency: "GBP",
    },
  });
}

describe("cart merge on sign-in", () => {
  it("moves anonymous lines into the account's cart", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id });
    const user = await createCustomer();

    const anonymous = await createCart();
    await testDb.cartItem.create({ data: { cartId: anonymous.id, variantId: variant.id, quantity: 2 } });
    const account = await createCart({ userId: user.id });

    await mergeCarts(anonymous.token, account.id);

    const lines = await testDb.cartItem.findMany({ where: { cartId: account.id } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ variantId: variant.id, quantity: 2 });
  });

  it("sums quantities when both baskets hold the same variant", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id });
    const user = await createCustomer();

    const anonymous = await createCart();
    await testDb.cartItem.create({ data: { cartId: anonymous.id, variantId: variant.id, quantity: 3 } });
    const account = await createCart({ userId: user.id });
    await testDb.cartItem.create({ data: { cartId: account.id, variantId: variant.id, quantity: 1 } });

    await mergeCarts(anonymous.token, account.id);

    const lines = await testDb.cartItem.findMany({ where: { cartId: account.id } });
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(4);
  });

  it("caps a merged line at the per-line maximum", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id, stock: 500 });
    const user = await createCustomer();

    const anonymous = await createCart();
    await testDb.cartItem.create({ data: { cartId: anonymous.id, variantId: variant.id, quantity: 15 } });
    const account = await createCart({ userId: user.id });
    await testDb.cartItem.create({ data: { cartId: account.id, variantId: variant.id, quantity: 15 } });

    await mergeCarts(anonymous.token, account.id);

    const lines = await testDb.cartItem.findMany({ where: { cartId: account.id } });
    expect(lines[0].quantity).toBe(20);
  });

  it("abandons the anonymous cart so it cannot be merged twice", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id });
    const user = await createCustomer();

    const anonymous = await createCart();
    await testDb.cartItem.create({ data: { cartId: anonymous.id, variantId: variant.id, quantity: 2 } });
    const account = await createCart({ userId: user.id });

    await mergeCarts(anonymous.token, account.id);
    // A second sign-in with the same stale cookie must not double the basket.
    await mergeCarts(anonymous.token, account.id);

    expect((await testDb.cart.findUnique({ where: { id: anonymous.id } }))!.status).toBe("ABANDONED");
    const lines = await testDb.cartItem.findMany({ where: { cartId: account.id } });
    expect(lines[0].quantity).toBe(2);
  });

  it("does nothing when the source and destination are the same cart", async () => {
    const user = await createCustomer();
    const cart = await createCart({ userId: user.id });

    await expect(mergeCarts(cart.token, cart.id)).resolves.toBeUndefined();
    expect((await testDb.cart.findUnique({ where: { id: cart.id } }))!.status).toBe("ACTIVE");
  });
});
