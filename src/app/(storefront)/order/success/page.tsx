import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { getOrderForUser } from "@/server/orders";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

/**
 * Confirmation page.
 *
 * Arriving here proves nothing about payment: the page reads the order's real
 * status and, while it is still PENDING_PAYMENT, polls until the webhook lands
 * rather than claiming success.
 */
export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const [{ order: orderId }, actor] = await Promise.all([searchParams, getActor()]);
  if (!actor) redirect("/sign-in?next=/account/orders");
  if (!orderId) redirect("/account/orders");

  const order = await getOrderForUser(orderId, actor.id);
  if (!order) redirect("/account/orders");

  return (
    <OrderConfirmation
      orderId={order.id}
      orderNumber={order.orderNumber}
      status={order.status}
      email={order.email}
      currency={order.currency}
      totalCents={order.totalCents}
      subtotalCents={order.subtotalCents}
      discountCents={order.discountCents}
      shippingCents={order.shippingCents}
      taxCents={order.taxCents}
      shippingMethodName={order.shippingMethodName}
      address={
        order.shippingAddress
          ? {
              fullName: order.shippingAddress.fullName,
              line1: order.shippingAddress.line1,
              line2: order.shippingAddress.line2,
              city: order.shippingAddress.city,
              postalCode: order.shippingAddress.postalCode,
              countryCode: order.shippingAddress.countryCode,
            }
          : null
      }
      items={order.items.map((item) => ({
        id: item.id,
        title: item.productTitle,
        variantTitle: item.variantTitle,
        quantity: item.quantity,
        totalCents: item.totalCents,
        imageUrl: item.imageUrl,
      }))}
      deliveryEstimate={
        order.shippingMethod
          ? `${order.shippingMethod.minDeliveryDays}–${order.shippingMethod.maxDeliveryDays} working days`
          : null
      }
    />
  );
}
