import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { getOrderForUser } from "@/server/orders";
import { CUSTOMER_CANCELLABLE, FULFILMENT_TRACK, RETURNABLE, type OrderStatus } from "@/server/orders/state-machine";
import { formatMoney } from "@/lib/money";
import { OrderStatusPill } from "@/components/account/order-status-pill";
import { ProductImage } from "@/components/ui/product-image";
import { OrderActions } from "@/components/account/order-actions";

export const metadata: Metadata = { title: "Order", robots: { index: false, follow: false } };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();

  // Scoping by userId is the access control: another customer's id returns 404.
  const order = await getOrderForUser(id, actor.id);
  if (!order) notFound();

  const status = order.status as OrderStatus;
  const trackIndex = FULFILMENT_TRACK.indexOf(status);
  const shipment = order.shipments[0];

  return (
    <div>
      <Link href="/account/orders" className="text-[13px] text-muted underline underline-offset-4 hover:text-ink">
        Back to orders
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-3">Order {order.orderNumber}</h1>
          <p className="mt-2 text-[14px] text-muted">
            Placed{" "}
            <time dateTime={order.createdAt.toISOString()}>
              {order.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </time>
          </p>
        </div>
        <OrderStatusPill status={status} />
      </div>

      {trackIndex >= 0 ? (
        <ol className="mt-8 grid grid-cols-5 gap-1" aria-label="Order progress">
          {FULFILMENT_TRACK.map((step, index) => (
            <li key={step} className="text-center">
              <span
                className={`block h-1 ${index <= trackIndex ? "bg-ink" : "bg-line"}`}
                aria-hidden="true"
              />
              <span
                className={`mt-2 block text-[11px] tracking-[0.06em] uppercase ${
                  index <= trackIndex ? "text-ink" : "text-muted-soft"
                }`}
              >
                {step === "PAID" ? "Confirmed" : step.toLowerCase()}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {shipment ? (
        <section className="mt-8 border border-line p-5" aria-labelledby="tracking">
          <h2 id="tracking" className="font-display text-lg">
            Tracking
          </h2>
          <dl className="mt-3 space-y-1.5 text-[13.5px]">
            <div className="flex justify-between">
              <dt className="text-muted">Carrier</dt>
              <dd>{shipment.carrier}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tracking number</dt>
              <dd className="font-mono text-[12.5px]">{shipment.trackingNumber ?? "Available shortly"}</dd>
            </div>
          </dl>
          {shipment.events.length > 0 ? (
            <ol className="mt-4 space-y-2.5 border-t border-line pt-4">
              {shipment.events.map((event) => (
                <li key={event.id} className="flex gap-3 text-[13px]">
                  <time
                    dateTime={event.occurredAt.toISOString()}
                    className="tabular w-28 shrink-0 text-muted"
                  >
                    {event.occurredAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </time>
                  <span>
                    <span className="block">{event.description}</span>
                    {event.location ? <span className="block text-muted">{event.location}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          {shipment.trackingUrl ? (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-[13px] underline underline-offset-4 hover:text-clay"
            >
              Track with {shipment.carrier}
            </a>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="items">
        <h2 id="items" className="font-display text-lg">
          Items
        </h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-4">
              <span className="relative block h-20 w-16 shrink-0 overflow-hidden bg-paper-deep">
                <ProductImage src={item.imageUrl} alt="" sizes="64px" />
              </span>
              <span className="min-w-0 flex-1">
                {item.brandName ? (
                  <span className="block text-[11px] tracking-[0.1em] text-muted uppercase">{item.brandName}</span>
                ) : null}
                <span className="block text-[14px] font-medium">{item.productTitle}</span>
                <span className="block text-[13px] text-muted">
                  {item.variantTitle !== "Standard" ? `${item.variantTitle} · ` : ""}Qty {item.quantity}
                </span>
                <span className="block font-mono text-[11px] text-muted-soft">{item.sku}</span>
              </span>
              <span className="tabular text-[14px]">{formatMoney(item.totalCents, order.currency)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section aria-labelledby="totals">
          <h2 id="totals" className="font-display text-lg">
            Totals
          </h2>
          <dl className="mt-3 space-y-1.5 text-[13.5px]">
            <Row label="Subtotal" value={formatMoney(order.subtotalCents, order.currency)} />
            {order.discountCents > 0 ? (
              <Row
                label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
                value={`−${formatMoney(order.discountCents, order.currency)}`}
              />
            ) : null}
            <Row
              label={order.shippingMethodName ? `Delivery · ${order.shippingMethodName}` : "Delivery"}
              value={order.shippingCents === 0 ? "Free" : formatMoney(order.shippingCents, order.currency)}
            />
            <Row label="Tax" value={formatMoney(order.taxCents, order.currency)} />
            <div className="flex justify-between border-t border-line pt-2.5">
              <dt className="font-display text-base">Total</dt>
              <dd className="tabular font-display text-base">{formatMoney(order.totalCents, order.currency)}</dd>
            </div>
            {order.refundedCents > 0 ? (
              <Row label="Refunded" value={`−${formatMoney(order.refundedCents, order.currency)}`} />
            ) : null}
          </dl>
        </section>

        <section aria-labelledby="addresses">
          <h2 id="addresses" className="font-display text-lg">
            Delivery address
          </h2>
          {order.shippingAddress ? (
            <address className="mt-3 text-[13.5px] leading-relaxed text-ink-soft not-italic">
              {order.shippingAddress.fullName}
              <br />
              {[
                order.shippingAddress.line1,
                order.shippingAddress.line2,
                order.shippingAddress.city,
                order.shippingAddress.region,
                order.shippingAddress.postalCode,
                order.shippingAddress.countryCode,
              ]
                .filter(Boolean)
                .join(", ")}
            </address>
          ) : (
            <p className="mt-3 text-[13.5px] text-muted">Not recorded.</p>
          )}
        </section>
      </div>

      <OrderActions
        orderId={order.id}
        canCancel={CUSTOMER_CANCELLABLE.includes(status)}
        canReturn={RETURNABLE.includes(status) && order.returnRequests.length === 0}
        items={order.items.map((item) => ({
          id: item.id,
          title: item.productTitle,
          variantTitle: item.variantTitle,
          quantity: item.quantity - item.refundedQuantity,
        }))}
        existingReturn={
          order.returnRequests[0]
            ? { status: order.returnRequests[0].status, reason: order.returnRequests[0].reason }
            : null
        }
      />

      <section className="mt-12" aria-labelledby="history">
        <h2 id="history" className="font-display text-lg">
          History
        </h2>
        <ol className="mt-3 space-y-2 border-t border-line pt-4 text-[13px]">
          {order.statusHistory.map((event) => (
            <li key={event.id} className="flex gap-4">
              <time dateTime={event.createdAt.toISOString()} className="tabular w-32 shrink-0 text-muted">
                {event.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </time>
              <span>
                {event.note ?? `Status changed to ${event.to.toLowerCase().replace(/_/g, " ")}`}
              </span>
            </li>
          ))}
        </ol>
      </section>
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
