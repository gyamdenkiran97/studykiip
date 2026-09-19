import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/server/payments";
import { handlePaymentWebhook } from "@/server/payments/service";
import { logger } from "@/server/logger";
import { isAppError } from "@/server/errors";

/**
 * Payment webhook.
 *
 * The raw body is required for signature verification, so it is read as text
 * before any parsing. An unverified request is rejected with 403 and never
 * reaches the handler. Verified events are processed idempotently.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature =
    request.headers.get("stripe-signature") ?? request.headers.get("x-kwidus21-signature");

  try {
    const event = await getPaymentProvider().parseWebhook({ payload, signature });
    const result = await handlePaymentWebhook(event);
    logger.info("webhook.handled", { type: event.type, result });
    return NextResponse.json({ received: true, result });
  } catch (error) {
    if (isAppError(error) && error.code === "FORBIDDEN") {
      logger.warn("webhook.rejected", { reason: error.message });
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
    logger.error("webhook.error", { error });
    // A 500 asks the provider to retry; a 2xx would silently drop the event.
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
