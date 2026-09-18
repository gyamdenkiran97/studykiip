import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { requirePermission, can } from "@/server/auth/session";
import { getOrderById } from "@/server/orders";
import { allowedTransitions, type OrderStatus } from "@/server/orders/state-machine";
import { formatMoney } from "@/lib/money";
import { OrderStatusPill } from "@/components/account/order-status-pill";
import { PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { OrderAdminActions } from "@/components/admin/order-admin-actions";

export const metadata: Metadata = { title: "Order", robots: { index: false, follow: false } };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("order:read");
  const { id } = await params;

  const [order, canWrite, canRefund] = await Promise.all([
    getOrderById(id),
    can("order:write"),
    can("refund:write"),
  ]);
  if (!order) notFound();

  const status = order.status as OrderStatus;
  const refundable = order.totalCents - order.refundedCents;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Orders", href: "/admin/orders" },
          { label: order.orderNumber },
        ]}
        title={`Order ${order.orderNumber}`}
        description={`Placed ${order.createdAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}`}
        actions={
          <>
            <OrderStatusPill status={status} />
            <Link
              href={`/admin/orders/${order.id}/invoice`}
              className="inline-flex h-9 items-center gap-1.5 border border-line-strong px-3 text-[13px] hover:border-ink"
            >
              <Printer size={14} strokeWidth={1.7} />
              Invoice
            </Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          <Panel title="Items">
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th align="center">Qty</Th>
                  <Th align="right">Unit</Th>
                  <Th align="right">Tax</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <Td>
                      <span className="block font-medium">{item.productTitle}</span>
                      <span className="block text-[11.5px] text-muted">
                        {item.variantTitle !== "Standard" ? `${item.variantTitle} · ` : ""}
                        <span className="font-mono">{item.sku}</span>
                      </span>
                    </Td>
                    <Td align="center" className="tabular">
                      {item.quantity}
                      {item.refundedQuantity > 0 ? (
                        <span className="block text-[11px] text-clay">{item.refundedQuantity} refunded</span>
                      ) : null}
                    </Td>
                    <Td align="right" className="tabular">
                      {formatMoney(item.unitPriceCents, order.currency)}
                    </Td>
                    <Td align="right" className="tabular text-muted">
                      {formatMoney(item.taxCents, order.currency)}
                    </Td>
                    <Td align="right" className="tabular">
                      {formatMoney(item.totalCents, order.currency)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <dl className="space-y-1.5 border-t border-line px-5 py-4 text-[13px]">
              <Row label="Subtotal" value={formatMoney(order.subtotalCents, order.currency)} />
              {order.discountCents > 0 ? (
                <Row
                  label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
                  value={`−${formatMoney(order.discountCents, order.currency)}`}
                />
              ) : null}
              <Row
                label={order.shippingMethodName ?? "Delivery"}
                value={formatMoney(order.shippingCents, order.currency)}
              />
              <Row label="Tax" value={formatMoney(order.taxCents, order.currency)} />
              <div className="flex justify-between border-t border-line pt-2 font-medium">
                <dt>Total</dt>
                <dd className="tabular">{formatMoney(order.totalCents, order.currency)}</dd>
              </div>
              {order.refundedCents > 0 ? (
                <Row label="Refunded" value={`−${formatMoney(order.refundedCents, order.currency)}`} />
              ) : null}
            </dl>
          </Panel>

          <Panel title="Payments">
            {order.payments.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-muted">No payment recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-medium">
                          {payment.provider} · {payment.status.toLowerCase().replace(/_/g, " ")}
                        </p>
                        <p className="font-mono text-[11.5px] text-muted">{payment.providerRef}</p>
                      </div>
                      <div className="text-right">
                        <p className="tabular text-[13px]">{formatMoney(payment.amountCents, payment.currency)}</p>
                        {payment.methodBrand ? (
                          <p className="text-[11.5px] text-muted">
                            {payment.methodBrand} ···· {payment.methodLast4}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {payment.events.length > 0 ? (
                      <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[11.5px] text-muted">
                        {payment.events.slice(0, 5).map((event) => (
                          <li key={event.id} className="flex justify-between gap-4">
                            <span className="font-mono">{event.type}</span>
                            <time dateTime={event.createdAt.toISOString()}>
                              {event.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                            </time>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {order.refunds.length > 0 ? (
              <ul className="divide-y divide-line border-t border-line">
                {order.refunds.map((refund) => (
                  <li key={refund.id} className="flex items-center justify-between px-5 py-3 text-[13px]">
                    <span>
                      Refund · {refund.status.toLowerCase()}
                      {refund.reason ? <span className="block text-[11.5px] text-muted">{refund.reason}</span> : null}
                    </span>
                    <span className="tabular text-clay">
                      −{formatMoney(refund.amountCents, refund.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>

          <Panel title="History">
            <ol className="divide-y divide-line">
              {order.statusHistory.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-4 px-5 py-2.5 text-[12.5px]">
                  <span>
                    {event.from ? `${event.from} → ${event.to}` : event.to}
                    {event.note ? <span className="block text-muted">{event.note}</span> : null}
                  </span>
                  <time dateTime={event.createdAt.toISOString()} className="tabular shrink-0 text-muted">
                    {event.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                  </time>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <OrderAdminActions
            orderId={order.id}
            status={status}
            allowedStatuses={[...allowedTransitions(status)]}
            canWrite={canWrite}
            canRefund={canRefund}
            refundableCents={refundable}
            currency={order.currency}
            adminNote={order.adminNote}
            hasShipment={order.shipments.length > 0}
            returnRequest={
              order.returnRequests[0]
                ? {
                    id: order.returnRequests[0].id,
                    status: order.returnRequests[0].status,
                    reason: order.returnRequests[0].reason,
                    comment: order.returnRequests[0].comment,
                  }
                : null
            }
          />

          <Panel title="Customer">
            <div className="space-y-3 px-5 py-4 text-[13px]">
              <div>
                <p className="font-medium">{order.user.name}</p>
                <p className="text-muted">{order.user.email}</p>
              </div>
              <Link
                href={`/admin/customers/${order.user.id}`}
                className="inline-block text-[12.5px] underline underline-offset-4 hover:text-clay"
              >
                View customer
              </Link>
            </div>
          </Panel>

          <Panel title="Addresses">
            <div className="space-y-4 px-5 py-4 text-[12.5px] leading-relaxed">
              <div>
                <p className="mb-1 font-semibold text-muted uppercase">Delivery</p>
                {order.shippingAddress ? (
                  <address className="not-italic">
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
                    {order.shippingAddress.phone ? (
                      <>
                        <br />
                        {order.shippingAddress.phone}
                      </>
                    ) : null}
                  </address>
                ) : (
                  <p className="text-muted">Not recorded</p>
                )}
              </div>

              <div>
                <p className="mb-1 font-semibold text-muted uppercase">Billing</p>
                {order.billingAddress ? (
                  <address className="not-italic">
                    {order.billingAddress.fullName}
                    <br />
                    {[
                      order.billingAddress.line1,
                      order.billingAddress.city,
                      order.billingAddress.postalCode,
                      order.billingAddress.countryCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </address>
                ) : (
                  <p className="text-muted">Same as delivery</p>
                )}
              </div>

              {order.customerNote ? (
                <div>
                  <p className="mb-1 font-semibold text-muted uppercase">Customer note</p>
                  <p>{order.customerNote}</p>
                </div>
              ) : null}
            </div>
          </Panel>

          {order.shipments.length > 0 ? (
            <Panel title="Shipments">
              <ul className="divide-y divide-line">
                {order.shipments.map((shipment) => (
                  <li key={shipment.id} className="px-5 py-3 text-[12.5px]">
                    <p className="font-medium">{shipment.carrier}</p>
                    <p className="font-mono text-muted">{shipment.trackingNumber ?? "No tracking number"}</p>
                    <p className="mt-1 text-muted">{shipment.status.toLowerCase().replace(/_/g, " ")}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
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
