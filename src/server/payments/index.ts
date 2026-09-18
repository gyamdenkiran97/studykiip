import "server-only";
import { env } from "../env";
import { MockPaymentProvider } from "./mock-provider";
import { StripePaymentProvider } from "./stripe-provider";
import type { PaymentProvider } from "./provider";

let provider: PaymentProvider | null = null;

/** The configured provider. Chosen once, by environment, never by request. */
export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    provider = env.PAYMENT_PROVIDER === "stripe" ? new StripePaymentProvider() : new MockPaymentProvider();
  }
  return provider;
}

/** Test seam. */
export function setPaymentProvider(next: PaymentProvider | null): void {
  provider = next;
}

export * from "./provider";
