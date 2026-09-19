import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";
import { conflict, forbidden, notFound, outOfStock, validationError } from "../errors";
import {
  computeBreakdown,
  effectivePrice,
  isCouponUsable,
  type PricingCoupon,
  type PricingLine,
} from "../pricing";
import { commitReservation, releaseReservation, reserveStock } from "../inventory";
import { logger } from "../logger";
import { trackServerEvent } from "../analytics";
import {
  assertTransition,
  CUSTOMER_CANCELLABLE,
  RETURNABLE,
  STATUS_TIMESTAMP_FIELD,
  type OrderStatus,
} from "./state-machine";

/**
 * Orders.
 *
 * `createOrderFromCart` is the only way an order comes into existence. It runs
 * inside one transaction that re-reads every price from the catalog, recomputes
 * the totals, reserves stock, and writes the order — so the amount that reaches
 * the payment provider is derived from the database, never from the browser.
 */

export type PlaceOrderInput = {
  userId: string;
  cartId: string;
  email: string;
  shippingAddressId: string;
  billingAddressId: string;
  shippingMethodId: string;
  customerNote?: string;
};

/** Human-facing order number: sortable by date, unguessable in its suffix. */
function generateOrderNumber(): string {
  const now = new Date();
  const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate(),
  ).padStart(2, "0")}`;
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `KM-${datePart}-${random}`;
}

export async function createOrderFromCart(input: PlaceOrderInput) {
  return prisma.$transaction(
    async (tx) => {
      const cart = await tx.cart.findFirst({
        where: { id: input.cartId, status: "ACTIVE" },
        include: {
          coupon: { include: { restrictions: true } },
          items: {
            where: { savedForLater: false },
            include: {
              variant: {
                include: {
                  inventory: { select: { onHand: true, reserved: true } },
                  media: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
                  product: {
                    select: {
                      id: true,
                      title: true,
                      brandId: true,
                      status: true,
                      deletedAt: true,
                      brand: { select: { name: true } },
                      taxClass: { select: { rateBps: true } },
                      categories: { select: { categoryId: true } },
                      media: {
                        where: { variantId: null },
                        orderBy: { position: "asc" },
                        take: 1,
                        select: { url: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!cart) throw notFound("Your basket could not be found.");
      if (cart.userId !== input.userId) throw forbidden("That basket belongs to a different account.");
      if (cart.items.length === 0) throw validationError("Your basket is empty.");

      // Addresses must belong to the buyer — otherwise an id from another
      // account could be posted straight through.
      const [shippingAddress, billingAddress, shippingMethod] = await Promise.all([
        tx.address.findFirst({ where: { id: input.shippingAddressId, userId: input.userId, deletedAt: null } }),
        tx.address.findFirst({ where: { id: input.billingAddressId, userId: input.userId, deletedAt: null } }),
        tx.shippingMethod.findFirst({
          where: { id: input.shippingMethodId, isActive: true },
          include: { zone: true },
        }),
      ]);

      if (!shippingAddress) throw validationError("Choose a delivery address.");
      if (!billingAddress) throw validationError("Choose a billing address.");
      if (!shippingMethod) throw validationError("Choose a delivery method.");
      if (!shippingMethod.zone.countryCodes.includes(shippingAddress.countryCode)) {
        throw validationError("That delivery method is not available for your country.");
      }

      // Re-validate availability and rebuild prices from the catalog.
      const pricingLines: PricingLine[] = [];
      const unavailable: string[] = [];

      for (const item of cart.items) {
        const variant = item.variant;
        const product = variant.product;
        const available = variant.inventory.reduce((total, row) => total + row.onHand - row.reserved, 0);

        if (product.status !== "ACTIVE" || product.deletedAt || !variant.isActive || variant.deletedAt) {
          unavailable.push(product.title);
          continue;
        }
        if (!variant.allowBackorder && available < item.quantity) {
          unavailable.push(`${product.title} (${available} left)`);
          continue;
        }

        pricingLines.push({
          variantId: variant.id,
          productId: product.id,
          categoryIds: product.categories.map((entry) => entry.categoryId),
          brandId: product.brandId,
          quantity: item.quantity,
          unitPriceCents: effectivePrice(variant).unitPriceCents,
          taxRateBps: product.taxClass?.rateBps ?? 2000,
        });
      }

      if (unavailable.length > 0) {
        throw outOfStock(`These items are no longer available: ${unavailable.join(", ")}`, { unavailable });
      }

      // Re-validate the coupon at order time, not just when it was applied.
      const now = new Date();
      let coupon: PricingCoupon | null = null;
      if (cart.coupon) {
        const c = cart.coupon;
        const usable = isCouponUsable(c);

        if (usable && c.usageLimitPerUser !== null) {
          const used = await tx.couponRedemption.count({ where: { couponId: c.id, userId: input.userId } });
          if (used >= c.usageLimitPerUser) throw conflict("You have already used that discount code.");
        }
        if (!usable) throw validationError("The discount code on your basket is no longer valid.");

        coupon = {
          id: c.id,
          code: c.code,
          discountType: c.discountType,
          discountValue: c.discountValue,
          minSubtotalCents: c.minSubtotalCents,
          maxDiscountCents: c.maxDiscountCents,
          restrictions: c.restrictions.map((r) => ({ scope: r.scope, targetId: r.targetId })),
        };
      }

      const breakdown = computeBreakdown({
        lines: pricingLines,
        coupon,
        shipping: { priceCents: shippingMethod.priceCents, freeOverCents: shippingMethod.freeOverCents },
      });

      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: input.userId,
          email: input.email,
          status: "PENDING_PAYMENT",
          currency: cart.currency,
          subtotalCents: breakdown.subtotalCents,
          discountCents: breakdown.discountCents,
          shippingCents: breakdown.shippingCents,
          taxCents: breakdown.taxCents,
          totalCents: breakdown.totalCents,
          couponId: coupon?.id ?? null,
          couponCode: coupon?.code ?? null,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
          shippingMethodId: shippingMethod.id,
          shippingMethodName: shippingMethod.name,
          customerNote: input.customerNote?.slice(0, 500) ?? null,
          placedAt: now,
        },
      });

      // Line items snapshot the product as sold: later catalog edits must not
      // rewrite history on an order.
      for (const line of breakdown.lines) {
        const item = cart.items.find((entry) => entry.variantId === line.variantId)!;
        const variant = item.variant;
        const product = variant.product;

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            variantId: variant.id,
            productTitle: product.title,
            variantTitle: variant.title,
            sku: variant.sku,
            imageUrl: variant.media[0]?.url ?? product.media[0]?.url ?? null,
            brandName: product.brand?.name ?? null,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            discountCents: line.discountCents,
            taxCents: line.taxCents,
            totalCents: line.totalCents,
          },
        });
      }

      await reserveStock(
        tx,
        breakdown.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        { orderId: order.id },
      );

      await tx.orderStatusEvent.create({
        data: { orderId: order.id, from: null, to: "PENDING_PAYMENT", note: "Order placed" },
      });

      // The cart is retired so a refresh cannot place it twice.
      await tx.cart.update({ where: { id: cart.id }, data: { status: "CONVERTED" } });

      logger.info("order.created", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalCents: order.totalCents,
      });

      return order;
    },
    { timeout: 20_000, isolationLevel: "ReadCommitted" },
  );
}

/**
 * Move an order to a new status, enforcing the state machine, stamping the
 * matching timestamp and keeping inventory consistent.
 */
export async function transitionOrder(input: {
  orderId: string;
  to: OrderStatus;
  actorId?: string | null;
  note?: string;
}): Promise<void> {
  const { orderId, to, actorId, note } = input;

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, inventoryCommitted: true, inventoryReleased: true },
    });
    if (!order) throw notFound("Order not found");

    const from = order.status as OrderStatus;
    if (from === to) return;
    assertTransition(from, to);

    const data: Prisma.OrderUpdateInput = { status: to };
    const timestampField = STATUS_TIMESTAMP_FIELD[to];
    if (timestampField) {
      (data as Record<string, unknown>)[timestampField] = new Date();
    }

    await tx.order.update({ where: { id: orderId }, data });
    await tx.orderStatusEvent.create({ data: { orderId, from, to, note, actorId: actorId ?? null } });

    // Stock follows the status: committed when paid, returned when the order
    // is cancelled, returned or fully refunded.
    if (to === "PAID") {
      await commitReservation(tx, orderId);
    } else if (to === "CANCELLED" || to === "RETURNED" || to === "REFUNDED") {
      await releaseReservation(tx, orderId);
    }
  });

  logger.info("order.transitioned", { orderId, to, actorId });
}

/** Customer-facing cancellation, restricted to the early statuses. */
export async function cancelOrderAsCustomer(orderId: string, userId: string, reason?: string): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, status: true },
  });
  if (!order) throw notFound("Order not found");
  if (!CUSTOMER_CANCELLABLE.includes(order.status as OrderStatus)) {
    throw conflict("This order has progressed too far to cancel. Please request a return instead.");
  }
  await transitionOrder({
    orderId,
    to: "CANCELLED",
    actorId: userId,
    note: reason ? `Cancelled by customer: ${reason}` : "Cancelled by customer",
  });
}

export async function requestReturn(input: {
  orderId: string;
  userId: string;
  reason: string;
  comment?: string;
  items: Array<{ orderItemId: string; quantity: number }>;
}) {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, userId: input.userId },
    include: { items: true, returnRequests: { where: { status: { notIn: ["REJECTED", "CANCELLED"] } } } },
  });
  if (!order) throw notFound("Order not found");
  if (!RETURNABLE.includes(order.status as OrderStatus)) {
    throw conflict("Returns can be opened once an order has shipped.");
  }
  if (order.returnRequests.length > 0) {
    throw conflict("A return is already open for this order.");
  }
  if (input.items.length === 0) throw validationError("Choose at least one item to return.");

  for (const requested of input.items) {
    const item = order.items.find((entry) => entry.id === requested.orderItemId);
    if (!item) throw validationError("That item is not part of this order.");
    if (requested.quantity < 1 || requested.quantity > item.quantity - item.refundedQuantity) {
      throw validationError("Return quantity is more than was purchased.");
    }
  }

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.returnRequest.create({
      data: {
        orderId: order.id,
        userId: input.userId,
        reason: input.reason,
        comment: input.comment?.slice(0, 1000),
        items: {
          create: input.items.map((item) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
          })),
        },
      },
    });
    return created;
  });

  if (order.status === "DELIVERED" || order.status === "SHIPPED") {
    await transitionOrder({
      orderId: order.id,
      to: "RETURN_REQUESTED",
      actorId: input.userId,
      note: `Return requested: ${input.reason}`,
    });
  }

  return request;
}

const ORDER_DETAIL_INCLUDE = {
  items: true,
  payments: { orderBy: { createdAt: "desc" as const }, include: { events: { orderBy: { createdAt: "desc" as const } } } },
  refunds: { orderBy: { createdAt: "desc" as const } },
  shipments: { include: { events: { orderBy: { occurredAt: "desc" as const } } } },
  statusHistory: { orderBy: { createdAt: "asc" as const } },
  returnRequests: { include: { items: true } },
  shippingAddress: true,
  billingAddress: true,
  shippingMethod: { select: { name: true, minDeliveryDays: true, maxDeliveryDays: true } },
} satisfies Prisma.OrderInclude;

/** Customer order lookup. The userId in the where clause is the IDOR guard. */
export async function getOrderForUser(orderId: string, userId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    include: ORDER_DETAIL_INCLUDE,
  });
}

export async function getOrderByNumberForUser(orderNumber: string, userId: string) {
  return prisma.order.findFirst({
    where: { orderNumber, userId },
    include: ORDER_DETAIL_INCLUDE,
  });
}

export async function listOrdersForUser(userId: string, options: { take?: number; skip?: number } = {}) {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: options.take ?? 10,
      skip: options.skip ?? 0,
      include: {
        items: { select: { id: true, productTitle: true, variantTitle: true, imageUrl: true, quantity: true } },
        shipments: { select: { trackingNumber: true, trackingUrl: true, carrier: true, status: true } },
      },
    }),
    prisma.order.count({ where: { userId } }),
  ]);
  return { orders, total };
}

/** Admin order lookup — permission is checked by the caller. */
export async function getOrderById(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      ...ORDER_DETAIL_INCLUDE,
      user: { select: { id: true, name: true, email: true, createdAt: true } },
    },
  });
}

export async function markOrderPaid(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) throw notFound("Order not found");
  if (order.status !== "PENDING_PAYMENT") return; // already handled — idempotent
  await transitionOrder({ orderId, to: "PAID", note: "Payment confirmed by provider webhook" });
  await trackServerEvent("purchase", { orderId });
}
