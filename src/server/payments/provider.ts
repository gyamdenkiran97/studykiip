import "server-only";

/**
 * Payment provider interface.
 *
 * Checkout, the webhook and the admin refund flow all speak to this interface,
 * never to a vendor SDK directly. Two implementations ship: Stripe for
 * production, and a deterministic mock for local development and CI so the
 * whole purchase path is testable without network access or real credentials.
 *
 * Amounts always come from the server-calculated order. Card data never touches
 * our servers — the client talks to the provider's hosted element directly.
 */

export type PaymentIntentResult = {
  /** Provider-side identifier stored on the Payment row. */
  providerRef: string;
  /** Opaque value the browser needs to confirm payment. Never persisted. */
  clientSecret: string;
  status: "REQUIRES_PAYMENT" | "PROCESSING" | "SUCCEEDED";
};

export type RefundResult = {
  providerRef: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
};

export type WebhookEvent = {
  /** Unique provider event id; used to make webhook handling idempotent. */
  id: string;
  type: string;
  paymentRef: string | null;
  amountCents: number | null;
  currency: string | null;
  methodBrand?: string | null;
  methodLast4?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  raw: unknown;
};

export interface PaymentProvider {
  readonly name: "stripe" | "mock";

  createPaymentIntent(input: {
    orderId: string;
    orderNumber: string;
    amountCents: number;
    currency: string;
    customerEmail: string;
    /** Prevents a retried request from creating a second charge. */
    idempotencyKey: string;
  }): Promise<PaymentIntentResult>;

  refund(input: {
    paymentRef: string;
    amountCents: number;
    reason?: string;
    idempotencyKey: string;
  }): Promise<RefundResult>;

  /** Verifies the signature and parses the payload. Throws if unverified. */
  parseWebhook(input: { payload: string; signature: string | null }): Promise<WebhookEvent>;

  /** Confirms current status directly with the provider (reconciliation). */
  retrieveStatus(paymentRef: string): Promise<"REQUIRES_PAYMENT" | "PROCESSING" | "SUCCEEDED" | "FAILED">;
}
