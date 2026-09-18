"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, Package } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/ui/product-image";
import { getOrderStatusAction } from "@/server/actions/checkout";

/**
 * Order confirmation.
 *
 * While the order is still awaiting the provider's webhook, the page says so
 * plainly and polls for the real status. It never announces a successful
 * payment on the strength of a redirect.
 */
export function OrderConfirmation({
  orderId,
  orderNumber,
  status: initialStatus,
  email,
  currency,
  totalCents,
  subtotalCents,
  discountCents,
  shippingCents,
  taxCents,
  shippingMethodName,
  address,
  items,
  deliveryEstimate,
}: {
  orderId: string;
  orderNumber: string;
  status: string;
  email: string;
  currency: string;
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  shippingMethodName: string | null;
  address: {
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    postalCode: string;
    countryCode: string;
  } | null;
  items: Array<{
    id: string;
    title: string;
    variantTitle: string;
    quantity: number;
    totalCents: number;
    imageUrl: string | null;
  }>;
  deliveryEstimate: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const awaiting = status === "PENDING_PAYMENT";

  useEffect(() => {
    if (!awaiting) return;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      const result = await getOrderStatusAction({ orderId });
      if (result.ok && result.data.status !== "PENDING_PAYMENT") {
        setStatus(result.data.status);
        router.refresh();
        clearInterval(timer);
      }
      // Give up politely after a minute; the order page stays available.
      if (attempts >= 20) clearInterval(timer);
    }, 3000);

    return () => clearInterval(timer);
  }, [awaiting, orderId, router]);

  return (
    <div className="shell py-14 lg:py-20">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <span
            className={`grid h-10 w-10 place-items-center ${awaiting ? "bg-paper-deep text-muted" : "bg-success text-paper"}`}
            aria-hidden="true"
          >
            {awaiting ? <Clock size={19} strokeWidth={1.6} /> : <Check size={20} strokeWidth={2.2} />}
          </span>
          <div>
            <h1 className="text-display-3">{awaiting ? "Confirming your payment" : "Thank you"}</h1>
            <p className="mt-1 text-[14px] text-muted" aria-live="polite">
              {awaiting
                ? "We are waiting for your payment provider to confirm. This usually takes a few seconds."
                : `Order ${orderNumber} is confirmed. A receipt is on its way to ${email}.`}
            </p>
          </div>
        </div>

        <div className="mt-10 border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
            <div>
              <p className="eyebrow">Order number</p>
              <p className="mt-1 font-mono text-[13px]">{orderNumber}</p>
            </div>
            {deliveryEstimate ? (
              <div className="text-right">
                <p className="eyebrow">Estimated delivery</p>
                <p className="mt-1 text-[13px]">{deliveryEstimate}</p>
              </div>
            ) : null}
          </div>

          <ul className="divide-y divide-line px-6">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-4">
                <span className="relative block h-16 w-13 shrink-0 overflow-hidden bg-paper-deep">
                  <ProductImage src={item.imageUrl} alt="" sizes="52px" />
                </span>
                <span className="min-w-0 flex-1 text-[13.5px]">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block text-muted">
                    {item.variantTitle !== "Standard" ? `${item.variantTitle} · ` : ""}
                    Qty {item.quantity}
                  </span>
                </span>
                <span className="tabular text-[13.5px]">{formatMoney(item.totalCents, currency)}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-1.5 border-t border-line px-6 py-4 text-[13.5px]">
            <Row label="Subtotal" value={formatMoney(subtotalCents, currency)} />
            {discountCents > 0 ? (
              <Row label="Discount" value={`−${formatMoney(discountCents, currency)}`} />
            ) : null}
            <Row
              label={shippingMethodName ? `Delivery · ${shippingMethodName}` : "Delivery"}
              value={shippingCents === 0 ? "Free" : formatMoney(shippingCents, currency)}
            />
            <Row label="Tax" value={formatMoney(taxCents, currency)} />
            <div className="flex justify-between border-t border-line pt-2.5">
              <dt className="font-display text-base">Total</dt>
              <dd className="tabular font-display text-base">{formatMoney(totalCents, currency)}</dd>
            </div>
          </dl>

          {address ? (
            <div className="border-t border-line px-6 py-4">
              <p className="eyebrow">Delivering to</p>
              <address className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft not-italic">
                {address.fullName}
                <br />
                {[address.line1, address.line2, address.city, address.postalCode, address.countryCode]
                  .filter(Boolean)
                  .join(", ")}
              </address>
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/account/orders/${orderId}`}>
              <Package size={16} strokeWidth={1.7} />
              Track this order
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/shop">Continue shopping</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
