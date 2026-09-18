"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../db";
import { conflict, notFound, toActionError, type ActionResult } from "../errors";
import { requireActor, requestIp } from "../auth/session";
import { rateLimit, RATE_LIMITS } from "../rate-limit";
import { findCurrentCart } from "../cart";
import { createOrderFromCart } from "../orders";
import { createPaymentForOrder, handlePaymentWebhook } from "../payments/service";
import { getPaymentProvider } from "../payments";
import { buildMockWebhook, MockPaymentProvider } from "../payments/mock-provider";
import { cuid } from "../validation/common";
import { env } from "../env";
import { trackServerEvent } from "../analytics";
import { logger } from "../logger";

/**
 * Checkout.
 *
 * `placeOrderAction` is the only entry point. It takes ids — never amounts —
 * and returns the order plus a client secret. The order total is computed
 * server-side inside the same transaction that reserves stock.
 */

const placeOrderSchema = z.object({
  shippingAddressId: cuid,
  billingAddressId: cuid,
  shippingMethodId: cuid,
  customerNote: z.string().trim().max(500).optional(),
});

export async function placeOrderAction(input: unknown): Promise<
  ActionResult<{
    orderId: string;
    orderNumber: string;
    clientSecret: string;
    providerRef: string;
    provider: string;
    amountCents: number;
    currency: string;
  }>
> {
  try {
    const parsed = placeOrderSchema.parse(input);
    const actor = await requireActor();

    const limit = await rateLimit(`checkout:${actor.id}:${await requestIp()}`, RATE_LIMITS.checkout);
    if (!limit.success) {
      return { ok: false, code: "RATE_LIMITED", message: "Too many checkout attempts. Please wait a moment." };
    }

    const cart = await findCurrentCart();
    if (!cart || cart.items.filter((item) => !item.savedForLater).length === 0) {
      throw conflict("Your basket is empty.");
    }

    const order = await createOrderFromCart({
      userId: actor.id,
      cartId: cart.id,
      email: actor.email,
      shippingAddressId: parsed.shippingAddressId,
      billingAddressId: parsed.billingAddressId,
      shippingMethodId: parsed.shippingMethodId,
      customerNote: parsed.customerNote,
    });

    const payment = await createPaymentForOrder(order.id);
    await trackServerEvent("begin_checkout", { orderId: order.id, amountCents: order.totalCents });

    revalidatePath("/cart");
    revalidatePath("/account/orders");

    return {
      ok: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        clientSecret: payment.clientSecret,
        providerRef: payment.providerRef,
        provider: payment.provider,
        amountCents: payment.amountCents,
        currency: payment.currency,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Development-only payment confirmation.
 *
 * Stands in for the provider's hosted card element: it marks the mock intent
 * settled, then builds a *signed* webhook payload and pushes it through the
 * real webhook handler — so the same code path that a live Stripe event takes
 * is exercised locally, signature verification included.
 *
 * Refused unless PAYMENT_PROVIDER is "mock"; production rejects that value at
 * boot (see src/server/env.ts).
 */
export async function confirmMockPaymentAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  try {
    if (env.PAYMENT_PROVIDER !== "mock") {
      return { ok: false, code: "FORBIDDEN", message: "Not available with a live payment provider." };
    }

    const { orderId, outcome } = z
      .object({ orderId: cuid, outcome: z.enum(["SUCCEEDED", "FAILED"]).default("SUCCEEDED") })
      .parse(input);

    const actor = await requireActor();

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: actor.id },
      select: {
        id: true,
        totalCents: true,
        currency: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1, select: { providerRef: true } },
      },
    });
    if (!order) throw notFound("Order not found");

    const providerRef = order.payments[0]?.providerRef;
    if (!providerRef) throw conflict("This order has no payment to confirm.");

    const provider = getPaymentProvider();
    if (provider instanceof MockPaymentProvider) {
      provider.confirm(providerRef, outcome);
    }

    const { payload, signature } = buildMockWebhook({
      type: outcome === "SUCCEEDED" ? "payment_intent.succeeded" : "payment_intent.payment_failed",
      paymentRef: providerRef,
      amountCents: order.totalCents,
      currency: order.currency,
    });

    const event = await provider.parseWebhook({ payload, signature });
    const status = await handlePaymentWebhook(event);

    logger.info("checkout.mock_payment_confirmed", { orderId, outcome, status });
    revalidatePath(`/order/success`);
    return { ok: true, data: { status } };
  } catch (error) {
    return toActionError(error);
  }
}

/** Polled by the confirmation page while it waits for the webhook. */
export async function getOrderStatusAction(input: unknown): Promise<
  ActionResult<{ status: string; paid: boolean }>
> {
  try {
    const { orderId } = z.object({ orderId: cuid }).parse(input);
    const actor = await requireActor();

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: actor.id },
      select: { status: true },
    });
    if (!order) throw notFound("Order not found");

    return {
      ok: true,
      data: { status: order.status, paid: order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED" },
    };
  } catch (error) {
    return toActionError(error);
  }
}
