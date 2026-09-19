import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { LegalPage } from "@/components/storefront/legal/legal-page";

export const metadata: Metadata = {
  title: "Returns & refunds",
  description: "How to return an item to Kwidus21, and how refunds work.",
  alternates: { canonical: "/returns" },
};

export default async function ReturnsPage() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "commerce" } });
  const returnDays = ((setting?.value ?? {}) as { returnWindowDays?: number }).returnWindowDays ?? 30;

  return (
    <LegalPage
      title="Returns &amp; refunds"
      intro={`You have ${returnDays} days from delivery to change your mind. Here is exactly how that works.`}
    >
      <h2>The short version</h2>
      <ul>
        <li>Start a return from the order page in your account.</li>
        <li>Send the item back unused and in its original packaging.</li>
        <li>We refund to the original payment method once it arrives.</li>
      </ul>

      <h2>What can be returned</h2>
      <p>
        Most items can be returned within {returnDays} days of delivery, provided they are unused, undamaged
        and in their original packaging with any tags still attached.
      </p>
      <p>
        Some things cannot be returned once opened, for reasons of hygiene or safety: cosmetics and skincare
        with a broken seal, pierced jewellery, and perishable food and drink. This does not affect your legal
        rights if an item is faulty or not as described.
      </p>

      <h2>Faulty or incorrect items</h2>
      <p>
        If an item arrives faulty, damaged or not as described, tell us and we will cover return postage and
        either replace it or refund it in full — including the delivery you originally paid.
      </p>

      <h2>How to start a return</h2>
      <ul>
        <li>Open the order in your account and choose “Return items”.</li>
        <li>Pick the items and a reason.</li>
        <li>We email a return label and instructions within one working day.</li>
      </ul>

      <h2>Refunds</h2>
      <p>
        Refunds are issued to the original payment method once we have received and checked the return.
        Depending on your bank, the money usually appears within three to five working days of us issuing it.
      </p>
      <p>
        Where only part of an order is returned, we refund the returned items and any delivery difference that
        applies. If a discount code was used, the refund reflects the amount actually paid for those items.
      </p>

      <h2>Cancelling before dispatch</h2>
      <p>
        An order that has not yet shipped can be cancelled outright from your account. The reserved stock is
        released immediately and any payment taken is refunded in full.
      </p>

      <h2>Your statutory rights</h2>
      <p>
        Nothing in this policy affects your statutory rights, including rights under consumer protection law
        relating to faulty goods or distance selling. The specific rights that apply depend on where you live
        and on the trading entity — one of the details this template needs filled in before launch.
      </p>
    </LegalPage>
  );
}
