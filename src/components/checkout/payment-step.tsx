"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Info } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { confirmMockPaymentAction } from "@/server/actions/checkout";

/**
 * Payment step.
 *
 * With Stripe configured this mounts the hosted Payment Element, so card data
 * goes straight from the browser to Stripe. With the mock provider (development
 * and CI) it offers explicit success/failure buttons that drive a signed
 * webhook through the real handler — the same path a live payment takes.
 *
 * Either way the order is only marked paid by the webhook, never by this
 * component and never by the redirect that follows it.
 */
export function PaymentStep({
  orderId,
  orderNumber,
  clientSecret,
  amountCents,
  currency,
  provider,
}: {
  orderId: string;
  orderNumber: string;
  clientSecret: string;
  amountCents: number;
  currency: string;
  provider: "stripe" | "mock";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function confirm(outcome: "SUCCEEDED" | "FAILED") {
    setPending(true);
    const result = await confirmMockPaymentAction({ orderId, outcome });
    setPending(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    if (outcome === "FAILED") {
      toast.error("The payment was declined. Try a different card.");
      return;
    }
    router.push(`/order/success?order=${orderId}`);
  }

  if (provider === "stripe") {
    return (
      <StripePaymentPanel
        clientSecret={clientSecret}
        orderId={orderId}
        amountCents={amountCents}
        currency={currency}
      />
    );
  }

  return (
    <div>
      <div className="flex items-start gap-3 border border-line-strong bg-paper-deep p-4">
        <Info size={17} strokeWidth={1.6} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
        <div className="text-[13px] leading-relaxed text-ink-soft">
          <p className="font-medium text-ink">Sandbox payment</p>
          <p className="mt-1">
            This store is running the development payment provider, so no card details are collected and no
            money moves. Confirming here signs a webhook and sends it through the same handler a live payment
            would use — including signature verification.
          </p>
        </div>
      </div>

      <dl className="mt-5 space-y-1.5 text-[13.5px]">
        <div className="flex justify-between">
          <dt className="text-muted">Order</dt>
          <dd className="font-mono text-[12.5px]">{orderNumber}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Amount</dt>
          <dd className="tabular font-medium">{formatMoney(amountCents, currency)}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button size="lg" disabled={pending} onClick={() => confirm("SUCCEEDED")}>
          <CreditCard size={16} strokeWidth={1.7} />
          {pending ? "Confirming…" : `Pay ${formatMoney(amountCents, currency)}`}
        </Button>
        <Button size="lg" variant="outline" disabled={pending} onClick={() => confirm("FAILED")}>
          Simulate a declined card
        </Button>
      </div>
    </div>
  );
}

/**
 * Stripe Payment Element.
 *
 * Loaded lazily so the Stripe bundle is not part of any page before checkout.
 * After confirmation Stripe redirects to the confirmation page, which waits for
 * the webhook rather than trusting the redirect.
 */
function StripePaymentPanel({
  clientSecret,
  orderId,
  amountCents,
  currency,
}: {
  clientSecret: string;
  orderId: string;
  amountCents: number;
  currency: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function pay() {
    setPending(true);
    setError(null);
    try {
      const [{ loadStripe }] = await Promise.all([import("@stripe/stripe-js")]);
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");
      if (!stripe) throw new Error("Stripe failed to load");

      const result = await stripe.confirmPayment({
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/order/success?order=${orderId}`,
        },
      });

      if (result.error) setError(result.error.message ?? "That payment could not be completed.");
    } catch {
      setError("We could not reach the payment provider. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="text-[13.5px] leading-relaxed text-muted">
        You will be taken to our payment provider to enter your card details. Card numbers never reach Kwidus21
        Mall&rsquo;s servers.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <Button size="lg" full className="mt-5" disabled={pending} onClick={pay}>
        <CreditCard size={16} strokeWidth={1.7} />
        {pending ? "Contacting provider…" : `Pay ${formatMoney(amountCents, currency)}`}
      </Button>
    </div>
  );
}
