import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { LegalPage } from "@/components/storefront/legal/legal-page";

export const metadata: Metadata = {
  title: "Delivery",
  description: "Delivery options, costs and timescales for Kwidus21 orders.",
  alternates: { canonical: "/shipping" },
};

export default async function ShippingPage() {
  // Rates come from the same table checkout prices against, so this page
  // cannot drift from what customers are actually charged.
  const methods = await prisma.shippingMethod.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { priceCents: "asc" }],
    include: { zone: { select: { name: true } } },
  });

  return (
    <LegalPage
      title="Delivery"
      intro="What it costs, how long it takes, and what happens when something goes wrong."
    >
      <h2>Options and rates</h2>
      <table>
        <caption className="sr-only">Delivery methods, destinations, prices and timescales</caption>
        <thead>
          <tr>
            <th scope="col">Method</th>
            <th scope="col">Destination</th>
            <th scope="col">Cost</th>
            <th scope="col">Working days</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((method) => (
            <tr key={method.id}>
              <td>{method.name}</td>
              <td>{method.zone.name}</td>
              <td>
                {formatMoney(method.priceCents)}
                {method.freeOverCents !== null ? (
                  <span className="block text-[12px] text-muted">
                    Free over {formatMoney(method.freeOverCents)}
                  </span>
                ) : null}
              </td>
              <td>
                {method.minDeliveryDays}–{method.maxDeliveryDays}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Dispatch</h2>
      <p>
        Orders placed before 2pm on a working day are usually dispatched the same day. Orders placed at the
        weekend or on a public holiday are dispatched the next working day. You will receive an email with
        tracking as soon as the parcel leaves us.
      </p>

      <h2>Tracking</h2>
      <p>
        Every order has a page in your account showing its current status and, once dispatched, the carrier
        and tracking number. You do not need an app or an account with the carrier to use it.
      </p>

      <h2>If something goes wrong</h2>
      <ul>
        <li>
          <strong>Nothing arrived.</strong> Carriers occasionally mark a parcel delivered a day early. If it
          has not appeared by the next working day, contact us and we will chase it.
        </li>
        <li>
          <strong>It arrived damaged.</strong> Photograph the packaging before you unpack further, then start a
          return from your order page. We will arrange a replacement or refund.
        </li>
        <li>
          <strong>The wrong item arrived.</strong> Tell us and we will send the right one and collect the wrong
          one at our cost.
        </li>
      </ul>

      <h2>Addresses outside our delivery zones</h2>
      <p>
        We currently deliver to the destinations listed above. If your country is not shown at checkout, we
        cannot ship there yet.
      </p>
    </LegalPage>
  );
}
