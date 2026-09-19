import { beforeEach, describe, expect, it } from "vitest";
import { testDb } from "./helpers/setup";
import {
  createAddress,
  createCart,
  createCustomer,
  createProduct,
  createShippingMethod,
  createTaxClass,
  createWarehouse,
  availableStock,
} from "./helpers/fixtures";
import { createOrderFromCart } from "@/server/orders";
import { createPaymentForOrder, handlePaymentWebhook, refundOrder } from "@/server/payments/service";
import { getPaymentProvider, setPaymentProvider } from "@/server/payments";
import { buildMockWebhook, MockPaymentProvider } from "@/server/payments/mock-provider";

/**
 * The rules these tests exist to defend:
 *   1. An order is paid only when a signature-verified provider event says so.
 *   2. A replayed event changes nothing.
 *   3. An event whose amount disagrees with the order is refused.
 */

async function placeOrder(options: { priceCents?: number; quantity?: number } = {}) {
  const [warehouse, taxClass, user, shippingMethod] = await Promise.all([
    createWarehouse(),
    createTaxClass(2000),
    createCustomer(),
    createShippingMethod({ priceCents: 495, freeOverCents: 5000 }),
  ]);

  const { variant } = await createProduct({
    warehouseId: warehouse.id,
    taxClassId: taxClass.id,
    priceCents: options.priceCents ?? 10_000,
    stock: 10,
  });
  const address = await createAddress(user.id);
  const cart = await createCart({
    userId: user.id,
    items: [{ variantId: variant.id, quantity: options.quantity ?? 1 }],
  });

  const order = await createOrderFromCart({
    userId: user.id,
    cartId: cart.id,
    email: user.email,
    shippingAddressId: address.id,
    billingAddressId: address.id,
    shippingMethodId: shippingMethod.id,
  });

  return { order, user, variant };
}

beforeEach(() => {
  // A fresh provider per test so mock intents never leak between cases.
  setPaymentProvider(new MockPaymentProvider());
});

describe("payment intents", () => {
  it("creates an intent for the server-calculated total", async () => {
    const { order } = await placeOrder({ priceCents: 10_000 });

    const payment = await createPaymentForOrder(order.id);

    expect(payment.amountCents).toBe(order.totalCents);
    const stored = await testDb.payment.findUniqueOrThrow({ where: { providerRef: payment.providerRef } });
    expect(stored.amountCents).toBe(order.totalCents);
    expect(stored.status).toBe("REQUIRES_PAYMENT");
  });

  it("reuses the same intent when checkout is retried", async () => {
    const { order } = await placeOrder();

    const first = await createPaymentForOrder(order.id);
    const second = await createPaymentForOrder(order.id);

    expect(second.providerRef).toBe(first.providerRef);
    expect(await testDb.payment.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("refuses to create a second intent once the order is paid", async () => {
    const { order } = await placeOrder();
    const payment = await createPaymentForOrder(order.id);

    const { payload, signature } = buildMockWebhook({
      type: "payment_intent.succeeded",
      paymentRef: payment.providerRef,
      amountCents: order.totalCents,
    });
    await handlePaymentWebhook(await getPaymentProvider().parseWebhook({ payload, signature }));

    await expect(createPaymentForOrder(order.id)).rejects.toThrow(/already been paid/i);
  });
});

describe("webhooks", () => {
  it("marks the order paid on a verified success event", async () => {
    const { order, variant } = await placeOrder();
    const payment = await createPaymentForOrder(order.id);

    const { payload, signature } = buildMockWebhook({
      type: "payment_intent.succeeded",
      paymentRef: payment.providerRef,
      amountCents: order.totalCents,
    });
    const event = await getPaymentProvider().parseWebhook({ payload, signature });
    expect(await handlePaymentWebhook(event)).toBe("paid");

    const updated = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("PAID");
    // Payment also moves the stock off the shelf.
    expect(await availableStock(variant.id)).toBe(9);
  });

  it("rejects a payload with an invalid signature", async () => {
    const { order } = await placeOrder();
    const payment = await createPaymentForOrder(order.id);

    const { payload } = buildMockWebhook({
      type: "payment_intent.succeeded",
      paymentRef: payment.providerRef,
      amountCents: order.totalCents,
    });

    await expect(
      getPaymentProvider().parseWebhook({ payload, signature: "not-the-right-signature" }),
    ).rejects.toThrow(/signature/i);

    // And with no signature at all.
    await expect(getPaymentProvider().parseWebhook({ payload, signature: null })).rejects.toThrow(
      /signature/i,
    );

    const untouched = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(untouched.status).toBe("PENDING_PAYMENT");
  });

  it("treats a replayed event as a no-op", async () => {
    const { order, variant } = await placeOrder();
    const payment = await createPaymentForOrder(order.id);

    const { payload, signature } = buildMockWebhook({
      type: "payment_intent.succeeded",
      paymentRef: payment.providerRef,
      amountCents: order.totalCents,
      eventId: "evt_fixed_for_replay",
    });

    const first = await handlePaymentWebhook(await getPaymentProvider().parseWebhook({ payload, signature }));
    const second = await handlePaymentWebhook(await getPaymentProvider().parseWebhook({ payload, signature }));

    expect(first).toBe("paid");
    expect(second).toBe("duplicate");

    // Stock moved exactly once.
    expect(await availableStock(variant.id)).toBe(9);
    expect(await testDb.paymentEvent.count()).toBe(1);
    const history = await testDb.orderStatusEvent.findMany({ where: { orderId: order.id, to: "PAID" } });
    expect(history).toHaveLength(1);
  });

  it("refuses an event whose amount does not match the order", async () => {
    const { order } = await placeOrder({ priceCents: 10_000 });
    const payment = await createPaymentForOrder(order.id);

    const { payload, signature } = buildMockWebhook({
      type: "payment_intent.succeeded",
      paymentRef: payment.providerRef,
      // Someone tries to settle a £120 order with £1.
      amountCents: 100,
    });

    const result = await handlePaymentWebhook(await getPaymentProvider().parseWebhook({ payload, signature }));
    expect(result).toBe("amount-mismatch");

    const untouched = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(untouched.status).toBe("PENDING_PAYMENT");
  });

  it("records a failed payment without touching the order", async () => {
    const { order } = await placeOrder();
    const payment = await createPaymentForOrder(order.id);

    const { payload, signature } = buildMockWebhook({
      type: "payment_intent.payment_failed",
      paymentRef: payment.providerRef,
      amountCents: order.totalCents,
    });
    expect(await handlePaymentWebhook(await getPaymentProvider().parseWebhook({ payload, signature }))).toBe(
      "failed",
    );

    const stored = await testDb.payment.findUniqueOrThrow({ where: { providerRef: payment.providerRef } });
    expect(stored.status).toBe("FAILED");
    const untouched = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(untouched.status).toBe("PENDING_PAYMENT");
  });

  it("counts a coupon redemption once, on payment", async () => {
    const coupon = await testDb.coupon.create({
      data: {
        code: `ONCE-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        discountType: "PERCENTAGE",
        discountValue: 1000,
      },
    });

    const [warehouse, taxClass, user, shippingMethod] = await Promise.all([
      createWarehouse(),
      createTaxClass(2000),
      createCustomer(),
      createShippingMethod(),
    ]);
    const { variant } = await createProduct({ warehouseId: warehouse.id, taxClassId: taxClass.id, stock: 5 });
    const address = await createAddress(user.id);
    const cart = await createCart({
      userId: user.id,
      items: [{ variantId: variant.id, quantity: 1 }],
      couponId: coupon.id,
    });

    const order = await createOrderFromCart({
      userId: user.id,
      cartId: cart.id,
      email: user.email,
      shippingAddressId: address.id,
      billingAddressId: address.id,
      shippingMethodId: shippingMethod.id,
    });

    const payment = await createPaymentForOrder(order.id);
    const { payload, signature } = buildMockWebhook({
      type: "payment_intent.succeeded",
      paymentRef: payment.providerRef,
      amountCents: order.totalCents,
      eventId: "evt_coupon_once",
    });

    await handlePaymentWebhook(await getPaymentProvider().parseWebhook({ payload, signature }));
    await handlePaymentWebhook(await getPaymentProvider().parseWebhook({ payload, signature }));

    const redemptions = await testDb.couponRedemption.count({ where: { couponId: coupon.id } });
    const updatedCoupon = await testDb.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(redemptions).toBe(1);
    expect(updatedCoupon.timesUsed).toBe(1);
  });
});

describe("refunds", () => {
  async function paidOrder() {
    const { order, user, variant } = await placeOrder({ priceCents: 10_000 });
    const payment = await createPaymentForOrder(order.id);
    const { payload, signature } = buildMockWebhook({
      type: "payment_intent.succeeded",
      paymentRef: payment.providerRef,
      amountCents: order.totalCents,
    });
    await handlePaymentWebhook(await getPaymentProvider().parseWebhook({ payload, signature }));
    return { order: await testDb.order.findUniqueOrThrow({ where: { id: order.id } }), user, variant };
  }

  it("records a partial refund and moves the order to PARTIALLY_REFUNDED", async () => {
    const { order } = await paidOrder();
    const staff = await testDb.user.create({
      data: { name: "Admin", email: `admin-${Math.random().toString(36).slice(2)}@example.test`, role: "ADMIN" },
    });

    await refundOrder({ orderId: order.id, amountCents: 2_000, reason: "Goodwill", actorId: staff.id });

    const updated = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.refundedCents).toBe(2_000);
    expect(updated.status).toBe("PARTIALLY_REFUNDED");

    const payment = await testDb.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.refundedCents).toBe(2_000);
    expect(payment.status).toBe("PARTIALLY_REFUNDED");
  });

  it("allows a second partial refund on an already partially refunded order", async () => {
    // A customer returns one item, then another. The order stays at
    // PARTIALLY_REFUNDED, and the state machine has no self-transitions — so
    // this used to throw AFTER the amounts had been committed, leaving the
    // provider refunded, the totals incremented and the refund row FAILED.
    const { order } = await paidOrder();
    const staff = await testDb.user.create({
      data: { name: "Admin", email: `admin-${Math.random().toString(36).slice(2)}@example.test`, role: "ADMIN" },
    });

    await refundOrder({ orderId: order.id, amountCents: 2_000, actorId: staff.id });
    await refundOrder({ orderId: order.id, amountCents: 1_500, actorId: staff.id });

    const updated = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.refundedCents).toBe(3_500);
    expect(updated.status).toBe("PARTIALLY_REFUNDED");

    const payment = await testDb.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.refundedCents).toBe(3_500);

    // Both refunds succeeded, and the money is accounted for exactly once.
    const refunds = await testDb.refund.findMany({ where: { orderId: order.id } });
    expect(refunds).toHaveLength(2);
    expect(refunds.every((refund) => refund.status === "SUCCEEDED")).toBe(true);
    expect(refunds.reduce((total, refund) => total + refund.amountCents, 0)).toBe(3_500);
  });

  it("closes the order when a later partial refund settles the balance", async () => {
    const { order, variant } = await paidOrder();
    const staff = await testDb.user.create({
      data: { name: "Admin", email: `admin-${Math.random().toString(36).slice(2)}@example.test`, role: "ADMIN" },
    });

    await refundOrder({ orderId: order.id, amountCents: 2_000, actorId: staff.id });
    await refundOrder({ orderId: order.id, amountCents: order.totalCents - 2_000, actorId: staff.id });

    const updated = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("REFUNDED");
    expect(updated.refundedCents).toBe(order.totalCents);
    expect(await availableStock(variant.id)).toBe(10);
  });

  it("leaves the totals untouched when a refund is refused", async () => {
    const { order } = await paidOrder();
    const staff = await testDb.user.create({
      data: { name: "Admin", email: `admin-${Math.random().toString(36).slice(2)}@example.test`, role: "ADMIN" },
    });

    await expect(
      refundOrder({ orderId: order.id, amountCents: order.totalCents + 1, actorId: staff.id }),
    ).rejects.toThrow();

    // Nothing moved: no refund row, no incremented totals, status unchanged.
    const updated = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.refundedCents).toBe(0);
    expect(updated.status).toBe("PAID");
    expect(await testDb.refund.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("a full refund closes the order and returns the stock", async () => {
    const { order, variant } = await paidOrder();
    const staff = await testDb.user.create({
      data: { name: "Admin", email: `admin-${Math.random().toString(36).slice(2)}@example.test`, role: "ADMIN" },
    });

    await refundOrder({ orderId: order.id, amountCents: order.totalCents, actorId: staff.id });

    const updated = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("REFUNDED");
    expect(await availableStock(variant.id)).toBe(10);
  });

  it("refuses to refund more than was paid", async () => {
    const { order } = await paidOrder();
    const staff = await testDb.user.create({
      data: { name: "Admin", email: `admin-${Math.random().toString(36).slice(2)}@example.test`, role: "ADMIN" },
    });

    await expect(
      refundOrder({ orderId: order.id, amountCents: order.totalCents + 1, actorId: staff.id }),
    ).rejects.toThrow(/refundable/i);

    const untouched = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(untouched.refundedCents).toBe(0);
  });
});
