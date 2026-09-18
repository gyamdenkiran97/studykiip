import "server-only";
import Stripe from "stripe";
import { env } from "../env";
import { AppError } from "../errors";
import type { PaymentIntentResult, PaymentProvider, RefundResult, WebhookEvent } from "./provider";

/**
 * Stripe implementation.
 *
 * The amount always comes from the caller (the server-computed order total).
 * The order id travels in metadata so the webhook can reconcile even if the
 * browser never comes back. Idempotency keys stop a retried request from
 * creating a second intent or a second refund.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  private client: Stripe;

  constructor() {
    if (!env.STRIPE_SECRET_KEY) {
      throw new AppError("INTERNAL", "STRIPE_SECRET_KEY is not configured");
    }
    this.client = new Stripe(env.STRIPE_SECRET_KEY, { typescript: true });
  }

  async createPaymentIntent(input: {
    orderId: string;
    orderNumber: string;
    amountCents: number;
    currency: string;
    customerEmail: string;
    idempotencyKey: string;
  }): Promise<PaymentIntentResult> {
    const intent = await this.client.paymentIntents.create(
      {
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        receipt_email: input.customerEmail,
        description: `Kiip Mall order ${input.orderNumber}`,
        metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
      },
      { idempotencyKey: input.idempotencyKey },
    );

    if (!intent.client_secret) {
      throw new AppError("PAYMENT_FAILED", "The payment provider did not return a client secret");
    }

    return {
      providerRef: intent.id,
      clientSecret: intent.client_secret,
      status:
        intent.status === "succeeded"
          ? "SUCCEEDED"
          : intent.status === "processing"
            ? "PROCESSING"
            : "REQUIRES_PAYMENT",
    };
  }

  async refund(input: {
    paymentRef: string;
    amountCents: number;
    reason?: string;
    idempotencyKey: string;
  }): Promise<RefundResult> {
    const refund = await this.client.refunds.create(
      {
        payment_intent: input.paymentRef,
        amount: input.amountCents,
        metadata: input.reason ? { reason: input.reason.slice(0, 200) } : undefined,
      },
      { idempotencyKey: input.idempotencyKey },
    );

    return {
      providerRef: refund.id,
      status: refund.status === "succeeded" ? "SUCCEEDED" : refund.status === "failed" ? "FAILED" : "PENDING",
    };
  }

  async parseWebhook(input: { payload: string; signature: string | null }): Promise<WebhookEvent> {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError("INTERNAL", "STRIPE_WEBHOOK_SECRET is not configured");
    }
    if (!input.signature) throw new AppError("FORBIDDEN", "Missing Stripe-Signature header");

    let event: Stripe.Event;
    try {
      // constructEvent performs the signature and timestamp checks; a failure
      // here means the request did not come from Stripe.
      event = this.client.webhooks.constructEvent(input.payload, input.signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new AppError("FORBIDDEN", "Invalid webhook signature");
    }

    const object = event.data.object as Stripe.PaymentIntent & {
      last_payment_error?: Stripe.PaymentIntent.LastPaymentError | null;
    };

    const charge = (object as unknown as { charges?: { data?: Stripe.Charge[] } }).charges?.data?.[0];
    const card = charge?.payment_method_details?.card;

    return {
      id: event.id,
      type: event.type,
      paymentRef: typeof object.id === "string" ? object.id : null,
      amountCents: typeof object.amount === "number" ? object.amount : null,
      currency: typeof object.currency === "string" ? object.currency.toUpperCase() : null,
      methodBrand: card?.brand ?? null,
      methodLast4: card?.last4 ?? null,
      failureCode: object.last_payment_error?.code ?? null,
      failureMessage: object.last_payment_error?.message ?? null,
      raw: event,
    };
  }

  async retrieveStatus(paymentRef: string) {
    const intent = await this.client.paymentIntents.retrieve(paymentRef);
    switch (intent.status) {
      case "succeeded":
        return "SUCCEEDED";
      case "processing":
        return "PROCESSING";
      case "canceled":
        return "FAILED";
      default:
        return "REQUIRES_PAYMENT";
    }
  }
}
