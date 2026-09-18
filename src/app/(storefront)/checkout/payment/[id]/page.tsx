import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { createPaymentForOrder } from "@/server/payments/service";
import { env } from "@/server/env";
import { PaymentStep } from "@/components/checkout/payment-step";
import { formatMoney } from "@/lib/money";

/**
 * Payment step.
 *
 * Deliberately its own route rather than a panel inside /checkout: placing an
 * order converts the basket, so a re-render of the checkout page would bounce
 * the customer to the empty-basket screen mid-payment. Having a URL also means
 * an unpaid order can be resumed later from the account area.
 */
export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
};

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, actor] = await Promise.all([params, getActor()]);
  if (!actor) redirect(`/sign-in?next=/checkout/payment/${id}`);

  const order = await prisma.order.findFirst({
    where: { id, userId: actor.id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      currency: true,
      shippingAddress: { select: { postalCode: true, city: true } },
    },
  });
  if (!order) notFound();

  // Already settled (or cancelled): send them somewhere useful instead.
  if (order.status !== "PENDING_PAYMENT") {
    redirect(`/order/success?order=${order.id}`);
  }

  // Idempotent: reuses the existing intent for this order and amount.
  const payment = await createPaymentForOrder(order.id);

  return (
    <div className="shell py-10 lg:py-16">
      <div className="mx-auto max-w-xl">
        <p className="eyebrow">Step 3 of 3</p>
        <h1 className="mt-3 text-display-3">Payment</h1>
        <p className="mt-3 text-[14.5px] text-muted">
          Order {order.orderNumber} is reserved for you. Nothing has been charged yet.
        </p>

        <div className="mt-8 border border-line bg-surface p-6">
          <PaymentStep
            orderId={order.id}
            orderNumber={order.orderNumber}
            clientSecret={payment.clientSecret}
            amountCents={payment.amountCents}
            currency={payment.currency}
            provider={env.PAYMENT_PROVIDER}
          />
        </div>

        <p className="mt-4 text-center text-[12.5px] text-muted">
          Total to pay {formatMoney(order.totalCents, order.currency)}. Your stock is held for this order
          until it is paid or cancelled.
        </p>
      </div>
    </div>
  );
}
