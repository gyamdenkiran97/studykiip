import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { getCartView } from "@/server/cart";
import { prisma } from "@/server/db";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

/**
 * Checkout requires an account: orders need an owner to be trackable,
 * returnable and refundable.
 */
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?next=/checkout");

  const cart = await getCartView();
  if (cart.lines.length === 0) redirect("/cart");

  const [addresses, shippingMethods] = await Promise.all([
    prisma.address.findMany({
      where: { userId: actor.id, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    prisma.shippingMethod.findMany({
      where: { isActive: true, zone: { isActive: true } },
      orderBy: [{ position: "asc" }, { priceCents: "asc" }],
      include: { zone: { select: { countryCodes: true } } },
    }),
  ]);

  return (
    <CheckoutFlow
      cart={cart}
      email={actor.email}
      addresses={addresses.map((address) => ({
        id: address.id,
        type: address.type,
        fullName: address.fullName,
        company: address.company,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        countryCode: address.countryCode,
        phone: address.phone,
        isDefault: address.isDefault,
      }))}
      shippingMethods={shippingMethods.map((method) => ({
        id: method.id,
        name: method.name,
        description: method.description,
        priceCents: method.priceCents,
        freeOverCents: method.freeOverCents,
        minDeliveryDays: method.minDeliveryDays,
        maxDeliveryDays: method.maxDeliveryDays,
        countryCodes: method.zone.countryCodes,
      }))}
    />
  );
}
