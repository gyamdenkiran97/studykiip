import { describe, expect, it } from "vitest";
import { testDb } from "./helpers/setup";
import {
  availableStock,
  createAddress,
  createCart,
  createCustomer,
  createProduct,
  createShippingMethod,
  createTaxClass,
  createWarehouse,
} from "./helpers/fixtures";
import { createOrderFromCart, getOrderForUser, transitionOrder } from "@/server/orders";
import { InvalidTransitionError } from "@/server/orders/state-machine";
import { AppError } from "@/server/errors";

/**
 * Order creation is the moment the shop commits: prices are re-read, stock is
 * reserved, and the total the customer will be charged is decided. Nothing the
 * browser sent is trusted here.
 */

async function scenario(options: {
  priceCents?: number;
  salePriceCents?: number | null;
  stock?: number;
  quantity?: number;
  taxRateBps?: number;
  couponId?: string;
} = {}) {
  const [warehouse, taxClass, user, shippingMethod] = await Promise.all([
    createWarehouse(),
    createTaxClass(options.taxRateBps ?? 2000),
    createCustomer(),
    createShippingMethod({ priceCents: 495, freeOverCents: 5000 }),
  ]);

  const { product, variant } = await createProduct({
    warehouseId: warehouse.id,
    taxClassId: taxClass.id,
    priceCents: options.priceCents ?? 10_000,
    salePriceCents: options.salePriceCents ?? null,
    stock: options.stock ?? 10,
  });

  const address = await createAddress(user.id);
  const cart = await createCart({
    userId: user.id,
    items: [{ variantId: variant.id, quantity: options.quantity ?? 1 }],
    couponId: options.couponId,
  });

  return { warehouse, taxClass, user, shippingMethod, product, variant, address, cart };
}

describe("order creation", () => {
  it("computes the total from the catalogue, not from the request", async () => {
    const context = await scenario({ priceCents: 10_000, quantity: 2 });

    const order = await createOrderFromCart({
      userId: context.user.id,
      cartId: context.cart.id,
      email: context.user.email,
      shippingAddressId: context.address.id,
      billingAddressId: context.address.id,
      shippingMethodId: context.shippingMethod.id,
    });

    // 2 × £100 = £200 subtotal, free delivery over £50, 20% VAT.
    expect(order.subtotalCents).toBe(20_000);
    expect(order.shippingCents).toBe(0);
    expect(order.taxCents).toBe(4_000);
    expect(order.totalCents).toBe(24_000);
    expect(order.status).toBe("PENDING_PAYMENT");
  });

  it("uses the sale price when one is active", async () => {
    const context = await scenario({ priceCents: 10_000, salePriceCents: 7_500 });

    const order = await createOrderFromCart({
      userId: context.user.id,
      cartId: context.cart.id,
      email: context.user.email,
      shippingAddressId: context.address.id,
      billingAddressId: context.address.id,
      shippingMethodId: context.shippingMethod.id,
    });

    expect(order.subtotalCents).toBe(7_500);
  });

  it("charges delivery below the free threshold", async () => {
    const context = await scenario({ priceCents: 2_000 });

    const order = await createOrderFromCart({
      userId: context.user.id,
      cartId: context.cart.id,
      email: context.user.email,
      shippingAddressId: context.address.id,
      billingAddressId: context.address.id,
      shippingMethodId: context.shippingMethod.id,
    });

    expect(order.shippingCents).toBe(495);
    expect(order.totalCents).toBe(2_000 + 495 + 400);
  });

  it("reserves stock and converts the basket", async () => {
    const context = await scenario({ stock: 5, quantity: 2 });

    const order = await createOrderFromCart({
      userId: context.user.id,
      cartId: context.cart.id,
      email: context.user.email,
      shippingAddressId: context.address.id,
      billingAddressId: context.address.id,
      shippingMethodId: context.shippingMethod.id,
    });

    expect(await availableStock(context.variant.id)).toBe(3);

    const cart = await testDb.cart.findUniqueOrThrow({ where: { id: context.cart.id } });
    expect(cart.status).toBe("CONVERTED");

    const items = await testDb.orderItem.findMany({ where: { orderId: order.id } });
    expect(items).toHaveLength(1);
    // Line items snapshot the product as sold.
    expect(items[0].sku).toBe(context.variant.sku);
    expect(items[0].unitPriceCents).toBe(10_000);
  });

  it("refuses to create an order for another customer's basket", async () => {
    const context = await scenario();
    const intruder = await createCustomer();
    const intruderAddress = await createAddress(intruder.id);

    await expect(
      createOrderFromCart({
        userId: intruder.id,
        cartId: context.cart.id,
        email: intruder.email,
        shippingAddressId: intruderAddress.id,
        billingAddressId: intruderAddress.id,
        shippingMethodId: context.shippingMethod.id,
      }),
    ).rejects.toThrow(/different account/i);
  });

  it("refuses an address that belongs to someone else", async () => {
    const context = await scenario();
    const other = await createCustomer();
    const otherAddress = await createAddress(other.id);

    await expect(
      createOrderFromCart({
        userId: context.user.id,
        cartId: context.cart.id,
        email: context.user.email,
        shippingAddressId: otherAddress.id,
        billingAddressId: otherAddress.id,
        shippingMethodId: context.shippingMethod.id,
      }),
    ).rejects.toThrow(/delivery address/i);
  });

  it("rejects the order when stock ran out after the basket was filled", async () => {
    const context = await scenario({ stock: 1, quantity: 1 });

    // Someone else takes the last unit first.
    await testDb.inventoryItem.updateMany({
      where: { variantId: context.variant.id },
      data: { onHand: 0 },
    });

    await expect(
      createOrderFromCart({
        userId: context.user.id,
        cartId: context.cart.id,
        email: context.user.email,
        shippingAddressId: context.address.id,
        billingAddressId: context.address.id,
        shippingMethodId: context.shippingMethod.id,
      }),
    ).rejects.toThrow(AppError);

    // The basket survives so the customer can fix it.
    const cart = await testDb.cart.findUniqueOrThrow({ where: { id: context.cart.id } });
    expect(cart.status).toBe("ACTIVE");
  });

  it("re-validates the coupon at order time, not only when it was applied", async () => {
    const expired = await testDb.coupon.create({
      data: {
        code: `EXPIRED-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        discountType: "PERCENTAGE",
        discountValue: 1000,
        endsAt: new Date(Date.now() - 86_400_000),
      },
    });

    const context = await scenario({ couponId: expired.id });

    await expect(
      createOrderFromCart({
        userId: context.user.id,
        cartId: context.cart.id,
        email: context.user.email,
        shippingAddressId: context.address.id,
        billingAddressId: context.address.id,
        shippingMethodId: context.shippingMethod.id,
      }),
    ).rejects.toThrow(/no longer valid/i);
  });

  it("applies a valid coupon and taxes the discounted net", async () => {
    const coupon = await testDb.coupon.create({
      data: {
        code: `TENOFF-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        discountType: "PERCENTAGE",
        discountValue: 1000,
      },
    });

    const context = await scenario({ priceCents: 10_000, couponId: coupon.id });

    const order = await createOrderFromCart({
      userId: context.user.id,
      cartId: context.cart.id,
      email: context.user.email,
      shippingAddressId: context.address.id,
      billingAddressId: context.address.id,
      shippingMethodId: context.shippingMethod.id,
    });

    expect(order.discountCents).toBe(1_000);
    expect(order.taxCents).toBe(1_800); // 20% of £90, not of £100
    expect(order.totalCents).toBe(10_800);
    expect(order.couponCode).toBe(coupon.code);
  });
});

describe("order lifecycle", () => {
  async function placedOrder() {
    const context = await scenario({ stock: 5, quantity: 2 });
    const order = await createOrderFromCart({
      userId: context.user.id,
      cartId: context.cart.id,
      email: context.user.email,
      shippingAddressId: context.address.id,
      billingAddressId: context.address.id,
      shippingMethodId: context.shippingMethod.id,
    });
    return { ...context, order };
  }

  it("paying commits the reservation into a stock decrement", async () => {
    const { order, variant } = await placedOrder();

    await transitionOrder({ orderId: order.id, to: "PAID" });

    const item = await testDb.inventoryItem.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(item.onHand).toBe(3);
    expect(item.reserved).toBe(0);

    const updated = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("PAID");
    expect(updated.paidAt).not.toBeNull();
    expect(updated.inventoryCommitted).toBe(true);
  });

  it("cancelling releases the reservation", async () => {
    const { order, variant } = await placedOrder();

    await transitionOrder({ orderId: order.id, to: "CANCELLED", note: "Customer changed their mind" });

    expect(await availableStock(variant.id)).toBe(5);
    const updated = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.cancelledAt).not.toBeNull();
  });

  it("refuses a transition the state machine does not declare", async () => {
    const { order } = await placedOrder();
    await expect(transitionOrder({ orderId: order.id, to: "DELIVERED" })).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it("writes a status event for every accepted transition", async () => {
    const { order } = await placedOrder();

    await transitionOrder({ orderId: order.id, to: "PAID" });
    await transitionOrder({ orderId: order.id, to: "PROCESSING" });

    const history = await testDb.orderStatusEvent.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((event) => event.to)).toEqual(["PENDING_PAYMENT", "PAID", "PROCESSING"]);
  });

  it("scopes order lookups to their owner", async () => {
    const { order, user } = await placedOrder();
    const intruder = await createCustomer();

    expect(await getOrderForUser(order.id, user.id)).not.toBeNull();
    // The IDOR guard: a valid id plus the wrong user is simply not found.
    expect(await getOrderForUser(order.id, intruder.id)).toBeNull();
  });
});
