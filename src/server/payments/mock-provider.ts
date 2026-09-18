import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "../env";
import { AppError } from "../errors";
import type { PaymentIntentResult, PaymentProvider, RefundResult, WebhookEvent } from "./provider";

/**
 * Deterministic development/CI payment provider.
 *
 * It mirrors the real thing where it matters: intents carry a server-fixed
 * amount, webhooks are HMAC-signed and verified with a constant-time compare,
 * and event ids are unique so replay protection can be exercised. It never
 * touches the network and is refused in production by src/server/env.ts.
 */

const SIGNING_SECRET = env.STRIPE_WEBHOOK_SECRET || "mock-webhook-secret-for-development-only";

type MockIntent = {
  ref: string;
  orderId: string;
  amountCents: number;
  currency: string;
  status: "REQUIRES_PAYMENT" | "PROCESSING" | "SUCCEEDED" | "FAILED";
};

const intents = new Map<string, MockIntent>();
const idempotency = new Map<string, string>();

export function signMockPayload(payload: string): string {
  return createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex");
}

/** Test helper: the payload a "provider" would post for a successful payment. */
export function buildMockWebhook(input: {
  type: string;
  paymentRef: string;
  amountCents: number;
  currency?: string;
  eventId?: string;
}): { payload: string; signature: string } {
  const payload = JSON.stringify({
    id: input.eventId ?? `evt_mock_${randomUUID()}`,
    type: input.type,
    data: {
      object: {
        id: input.paymentRef,
        amount: input.amountCents,
        currency: (input.currency ?? "gbp").toLowerCase(),
        payment_method_details: { card: { brand: "visa", last4: "4242" } },
      },
    },
  });
  return { payload, signature: signMockPayload(payload) };
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;

  async createPaymentIntent(input: {
    orderId: string;
    orderNumber: string;
    amountCents: number;
    currency: string;
    customerEmail: string;
    idempotencyKey: string;
  }): Promise<PaymentIntentResult> {
    const existingRef = idempotency.get(input.idempotencyKey);
    if (existingRef) {
      const existing = intents.get(existingRef)!;
      return {
        providerRef: existing.ref,
        clientSecret: `${existing.ref}_secret_mock`,
        status: existing.status === "FAILED" ? "REQUIRES_PAYMENT" : existing.status,
      };
    }

    const ref = `pi_mock_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    intents.set(ref, {
      ref,
      orderId: input.orderId,
      amountCents: input.amountCents,
      currency: input.currency,
      status: "REQUIRES_PAYMENT",
    });
    idempotency.set(input.idempotencyKey, ref);

    return { providerRef: ref, clientSecret: `${ref}_secret_mock`, status: "REQUIRES_PAYMENT" };
  }

  /** Called by the development-only confirm endpoint to simulate the customer paying. */
  confirm(paymentRef: string, outcome: "SUCCEEDED" | "FAILED" = "SUCCEEDED"): MockIntent {
    const intent = intents.get(paymentRef);
    if (!intent) throw new AppError("NOT_FOUND", "Unknown payment reference");
    intent.status = outcome;
    return intent;
  }

  async refund(input: { paymentRef: string; amountCents: number; idempotencyKey: string }): Promise<RefundResult> {
    const intent = intents.get(input.paymentRef);
    // A refund against an intent this process did not create (e.g. after a
    // restart) still succeeds: the order record is the source of truth.
    if (intent && input.amountCents > intent.amountCents) {
      throw new AppError("CONFLICT", "Refund exceeds the captured amount");
    }
    return { providerRef: `re_mock_${randomUUID().replace(/-/g, "").slice(0, 18)}`, status: "SUCCEEDED" };
  }

  async parseWebhook(input: { payload: string; signature: string | null }): Promise<WebhookEvent> {
    if (!input.signature) throw new AppError("FORBIDDEN", "Missing webhook signature");

    const expected = signMockPayload(input.payload);
    const provided = input.signature;
    const expectedBuffer = Buffer.from(expected, "utf8");
    const providedBuffer = Buffer.from(provided, "utf8");

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new AppError("FORBIDDEN", "Invalid webhook signature");
    }

    const parsed = JSON.parse(input.payload) as {
      id: string;
      type: string;
      data: {
        object: {
          id: string;
          amount: number;
          currency: string;
          payment_method_details?: { card?: { brand?: string; last4?: string } };
        };
      };
    };

    const object = parsed.data.object;
    const intent = intents.get(object.id);
    if (intent && parsed.type === "payment_intent.succeeded") intent.status = "SUCCEEDED";

    return {
      id: parsed.id,
      type: parsed.type,
      paymentRef: object.id,
      amountCents: object.amount,
      currency: object.currency?.toUpperCase() ?? null,
      methodBrand: object.payment_method_details?.card?.brand ?? null,
      methodLast4: object.payment_method_details?.card?.last4 ?? null,
      raw: parsed,
    };
  }

  async retrieveStatus(paymentRef: string) {
    return intents.get(paymentRef)?.status ?? "REQUIRES_PAYMENT";
  }
}
