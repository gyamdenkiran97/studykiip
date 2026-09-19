import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "../db";
import { conflict, notFound, validationError } from "../errors";
import { logger } from "../logger";
import { markOrderPaid, transitionOrder } from "../orders";
import { assertTransition, type OrderStatus } from "../orders/state-machine";
import { sendEmail } from "../email/transport";
import { orderConfirmationTemplate, paymentReceiptTemplate, refundTemplate } from "../email/templates";
import { env } from "../env";
import { trackServerEvent } from "../analytics";
import { getPaymentProvider, type WebhookEvent } from "./index";

/**
 * Payment orchestration.
 *
 * Rules that must not be broken:
 *   1. The charge amount is read from the order row, never from a request.
 *   2. An order is marked paid only by a signature-verified provider event —
 *      a browser landing on the success page proves nothing.
 *   3. Every webhook is recorded by its provider event id first, so a replayed
 *      or duplicated delivery is a no-op.
 */

export async function createPaymentForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      currency: true,
      email: true,
      payments: {
        where: { status: { in: ["REQUIRES_PAYMENT", "PROCESSING"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!order) throw notFound("Order not found");
  if (order.status !== "PENDING_PAYMENT") {
    throw conflict("This order has already been paid for.");
  }
  if (order.totalCents <= 0) {
    throw validationError("This order has no payable amount.");
  }

  const provider = getPaymentProvider();

  // One intent per order+amount: a retry reuses it rather than charging twice.
  const idempotencyKey = createHash("sha256")
    .update(`${order.id}:${order.totalCents}:${order.currency}`)
    .digest("hex");

  const intent = await provider.createPaymentIntent({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amountCents: order.totalCents,
    currency: order.currency,
    customerEmail: order.email,
    idempotencyKey,
  });

  await prisma.payment.upsert({
    where: { providerRef: intent.providerRef },
    create: {
      orderId: order.id,
      provider: provider.name,
      providerRef: intent.providerRef,
      status: intent.status,
      amountCents: order.totalCents,
      currency: order.currency,
    },
    update: { status: intent.status, amountCents: order.totalCents },
  });

  logger.info("payment.intent_created", {
    orderId: order.id,
    provider: provider.name,
    amountCents: order.totalCents,
  });

  // The client secret is returned to the browser but never stored.
  return {
    clientSecret: intent.clientSecret,
    providerRef: intent.providerRef,
    provider: provider.name,
    amountCents: order.totalCents,
    currency: order.currency,
  };
}

/**
 * Handle a verified webhook. Returns a short status string for the response
 * body; never throws for a duplicate.
 */
export async function handlePaymentWebhook(event: WebhookEvent): Promise<string> {
  // Recording the event id first is what makes this idempotent: the unique
  // constraint rejects a replay before any state changes.
  try {
    await prisma.paymentEvent.create({
      data: {
        providerEventId: event.id,
        type: event.type,
        payload: event.raw as never,
      },
    });
  } catch {
    logger.info("payment.webhook_duplicate", { eventId: event.id, type: event.type });
    return "duplicate";
  }

  if (!event.paymentRef) return "ignored";

  const payment = await prisma.payment.findUnique({
    where: { providerRef: event.paymentRef },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          email: true,
          currency: true,
          totalCents: true,
          subtotalCents: true,
          discountCents: true,
          shippingCents: true,
          taxCents: true,
          couponId: true,
          userId: true,
          items: { select: { productTitle: true, variantTitle: true, quantity: true, totalCents: true } },
        },
      },
    },
  });

  if (!payment) {
    logger.warn("payment.webhook_unknown_reference", { paymentRef: event.paymentRef, type: event.type });
    return "unknown-payment";
  }

  await prisma.paymentEvent.updateMany({
    where: { providerEventId: event.id },
    data: { paymentId: payment.id, handledAt: new Date() },
  });

  switch (event.type) {
    case "payment_intent.succeeded":
    case "checkout.session.completed": {
      // Guard against an event whose amount disagrees with the order.
      if (event.amountCents !== null && event.amountCents !== payment.amountCents) {
        logger.error("payment.amount_mismatch", {
          paymentId: payment.id,
          expected: payment.amountCents,
          received: event.amountCents,
        });
        return "amount-mismatch";
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCEEDED",
          methodBrand: event.methodBrand ?? null,
          methodLast4: event.methodLast4 ?? null,
        },
      });

      if (payment.order.status === "PENDING_PAYMENT") {
        await markOrderPaid(payment.orderId);
        await recordCouponRedemption(payment.orderId);
        await sendOrderEmails(payment.orderId);
      }
      return "paid";
    }

    case "payment_intent.payment_failed": {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureCode: event.failureCode ?? null,
          failureMessage: event.failureMessage?.slice(0, 500) ?? null,
        },
      });
      logger.warn("payment.failed", { orderId: payment.orderId, code: event.failureCode });
      return "failed";
    }

    case "payment_intent.canceled": {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
      return "cancelled";
    }

    case "charge.refunded": {
      // Refund bookkeeping is driven by the admin refund flow; this only keeps
      // the provider's view and ours from drifting.
      logger.info("payment.refund_event", { paymentId: payment.id });
      return "refund-noted";
    }

    default:
      return "ignored";
  }
}

async function recordCouponRedemption(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, couponId: true, userId: true, discountCents: true },
  });
  if (!order?.couponId || order.discountCents <= 0) return;

  try {
    await prisma.$transaction([
      prisma.couponRedemption.create({
        data: {
          couponId: order.couponId,
          userId: order.userId,
          orderId: order.id,
          amountCents: order.discountCents,
        },
      }),
      prisma.coupon.update({ where: { id: order.couponId }, data: { timesUsed: { increment: 1 } } }),
    ]);
  } catch {
    // The unique constraint on orderId means a replay cannot double-count.
    logger.info("coupon.redemption_already_recorded", { orderId });
  }
}

async function sendOrderEmails(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payments: { where: { status: "SUCCEEDED" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order) return;

  const url = `${env.NEXT_PUBLIC_APP_URL}/account/orders/${order.id}`;

  await sendEmail({
    to: order.email,
    ...orderConfirmationTemplate({
      orderNumber: order.orderNumber,
      currency: order.currency,
      items: order.items.map((item) => ({
        title: item.productTitle,
        variant: item.variantTitle,
        quantity: item.quantity,
        totalCents: item.totalCents,
      })),
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      totalCents: order.totalCents,
      url,
    }),
  });

  const payment = order.payments[0];
  if (payment) {
    await sendEmail({
      to: order.email,
      ...paymentReceiptTemplate({
        orderNumber: order.orderNumber,
        amountCents: payment.amountCents,
        currency: payment.currency,
        methodBrand: payment.methodBrand,
        methodLast4: payment.methodLast4,
        url,
      }),
    });
  }

  await prisma.notification.create({
    data: {
      userId: order.userId,
      type: "ORDER_CONFIRMED",
      title: `Order ${order.orderNumber} confirmed`,
      body: "We have your order and it is on its way to our warehouse.",
      href: `/account/orders/${order.id}`,
    },
  });
}

/**
 * Issue a refund. Called from the admin panel after a permission check.
 * Partial and full refunds both update the order's running refunded total and
 * move it to the right status.
 */
export async function refundOrder(input: {
  orderId: string;
  amountCents: number;
  reason?: string;
  actorId: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { payments: { where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } } } },
  });
  if (!order) throw notFound("Order not found");

  const payment = order.payments[0];
  if (!payment) throw conflict("This order has no captured payment to refund.");

  const remaining = order.totalCents - order.refundedCents;
  if (input.amountCents <= 0) throw validationError("Enter a refund amount greater than zero.");
  if (input.amountCents > remaining) {
    throw validationError("That is more than the amount still refundable on this order.");
  }

  /**
   * Work out where the order lands, and prove the move is legal, BEFORE any
   * money leaves the provider.
   *
   * A second partial refund keeps the order at PARTIALLY_REFUNDED, and the
   * state machine has no self-transitions — rightly, since a status that does
   * not change is not a transition. Asking for one anyway used to throw after
   * the amounts had already been committed, leaving the provider refunded, the
   * order's refundedCents incremented, and the refund row marked FAILED. The
   * status is simply left alone when it is already correct.
   */
  const currentStatus = order.status as OrderStatus;
  const nextStatus: OrderStatus = order.refundedCents + input.amountCents >= order.totalCents
    ? "REFUNDED"
    : "PARTIALLY_REFUNDED";
  if (nextStatus !== currentStatus) assertTransition(currentStatus, nextStatus);

  const provider = getPaymentProvider();
  const idempotencyKey = createHash("sha256")
    .update(`refund:${order.id}:${order.refundedCents}:${input.amountCents}`)
    .digest("hex");

  const refund = await prisma.refund.create({
    data: {
      orderId: order.id,
      paymentId: payment.id,
      amountCents: input.amountCents,
      currency: order.currency,
      reason: input.reason,
      status: "PENDING",
      actorId: input.actorId,
    },
  });

  try {
    const result = await provider.refund({
      paymentRef: payment.providerRef,
      amountCents: input.amountCents,
      reason: input.reason,
      idempotencyKey,
    });

    const totalRefunded = order.refundedCents + input.amountCents;
    const fullyRefunded = nextStatus === "REFUNDED";

    await prisma.$transaction([
      prisma.refund.update({
        where: { id: refund.id },
        data: { status: result.status, providerRef: result.providerRef },
      }),
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundedCents: { increment: input.amountCents },
          status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { refundedCents: totalRefunded },
      }),
    ]);

    if (nextStatus !== currentStatus) {
      await transitionOrder({
        orderId: order.id,
        to: nextStatus,
        actorId: input.actorId,
        note: input.reason ? `Refund: ${input.reason}` : "Refund issued",
      });
    }

    await sendEmail({
      to: order.email,
      ...refundTemplate({
        orderNumber: order.orderNumber,
        amountCents: input.amountCents,
        currency: order.currency,
        url: `${env.NEXT_PUBLIC_APP_URL}/account/orders/${order.id}`,
      }),
    });

    await trackServerEvent("refund", { orderId: order.id, amountCents: input.amountCents });
    logger.info("payment.refunded", { orderId: order.id, amountCents: input.amountCents, actorId: input.actorId });

    return refund;
  } catch (error) {
    await prisma.refund.update({ where: { id: refund.id }, data: { status: "FAILED" } });
    logger.error("payment.refund_failed", { orderId: order.id, error });
    throw error;
  }
}

/**
 * Reconciliation: ask the provider what it thinks, for orders still awaiting
 * payment. Covers a webhook that never arrived.
 */
export async function reconcilePendingPayments(limit = 25): Promise<number> {
  const payments = await prisma.payment.findMany({
    where: { status: { in: ["REQUIRES_PAYMENT", "PROCESSING"] }, createdAt: { lt: new Date(Date.now() - 300_000) } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, providerRef: true, orderId: true },
  });

  const provider = getPaymentProvider();
  let reconciled = 0;

  for (const payment of payments) {
    try {
      const status = await provider.retrieveStatus(payment.providerRef);
      if (status === "SUCCEEDED") {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } });
        await markOrderPaid(payment.orderId);
        await recordCouponRedemption(payment.orderId);
        await sendOrderEmails(payment.orderId);
        reconciled += 1;
      } else if (status === "FAILED") {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      }
    } catch (error) {
      logger.warn("payment.reconcile_failed", { paymentId: payment.id, error });
    }
  }

  if (reconciled > 0) logger.info("payment.reconciled", { count: reconciled });
  return reconciled;
}
