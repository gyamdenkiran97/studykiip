import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { getOrderById } from "@/server/orders";
import { prisma } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { PrintButton } from "@/components/admin/print-button";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

/**
 * Printable invoice.
 *
 * Plain semantic HTML with a print stylesheet rather than a PDF pipeline: it
 * prints identically from any browser, and "Save as PDF" is one keystroke away.
 * Legal wording is a placeholder pending business review.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("order:read");
  const { id } = await params;

  const [order, storeSetting] = await Promise.all([
    getOrderById(id),
    prisma.siteSetting.findUnique({ where: { key: "store" } }),
  ]);
  if (!order) notFound();

  const store = (storeSetting?.value ?? {}) as {
    name?: string;
    addressLines?: string[];
    supportEmail?: string;
    companyNumber?: string;
  };

  const paidPayment = order.payments.find((payment) => payment.status === "SUCCEEDED");

  return (
    <div className="mx-auto max-w-3xl bg-surface p-8 print:max-w-none print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
        <div>
          <p className="font-display text-2xl leading-none font-semibold tracking-[-0.04em]">Kiip</p>
          <address className="mt-3 text-[12px] leading-relaxed text-muted not-italic">
            {(store.addressLines ?? []).map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
            {store.supportEmail ? <span className="block">{store.supportEmail}</span> : null}
            {store.companyNumber ? <span className="block">Company no. {store.companyNumber}</span> : null}
          </address>
        </div>

        <div className="text-right">
          <h1 className="font-display text-xl">Invoice</h1>
          <dl className="mt-2 space-y-0.5 text-[12px]">
            <div className="flex justify-end gap-3">
              <dt className="text-muted">Order</dt>
              <dd className="font-mono">{order.orderNumber}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-muted">Date</dt>
              <dd>{order.createdAt.toLocaleDateString("en-GB", { dateStyle: "long" })}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-muted">Status</dt>
              <dd>{order.status.toLowerCase().replace(/_/g, " ")}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="grid gap-8 py-6 sm:grid-cols-2">
        <section>
          <h2 className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Billed to</h2>
          <address className="mt-2 text-[13px] leading-relaxed not-italic">
            {order.billingAddress?.fullName ?? order.user.name}
            <br />
            {order.billingAddress
              ? [
                  order.billingAddress.line1,
                  order.billingAddress.line2,
                  order.billingAddress.city,
                  order.billingAddress.region,
                  order.billingAddress.postalCode,
                  order.billingAddress.countryCode,
                ]
                  .filter(Boolean)
                  .join(", ")
              : order.user.email}
          </address>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Delivered to</h2>
          <address className="mt-2 text-[13px] leading-relaxed not-italic">
            {order.shippingAddress?.fullName}
            <br />
            {order.shippingAddress
              ? [
                  order.shippingAddress.line1,
                  order.shippingAddress.line2,
                  order.shippingAddress.city,
                  order.shippingAddress.region,
                  order.shippingAddress.postalCode,
                  order.shippingAddress.countryCode,
                ]
                  .filter(Boolean)
                  .join(", ")
              : "—"}
          </address>
        </section>
      </div>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-y border-line text-left">
            <th scope="col" className="py-2 font-medium">
              Description
            </th>
            <th scope="col" className="py-2 text-center font-medium">
              Qty
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Unit
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-line">
              <td className="py-2.5">
                {item.productTitle}
                {item.variantTitle !== "Standard" ? (
                  <span className="block text-[11.5px] text-muted">{item.variantTitle}</span>
                ) : null}
                <span className="block font-mono text-[11px] text-muted">{item.sku}</span>
              </td>
              <td className="tabular py-2.5 text-center">{item.quantity}</td>
              <td className="tabular py-2.5 text-right">{formatMoney(item.unitPriceCents, order.currency)}</td>
              <td className="tabular py-2.5 text-right">{formatMoney(item.totalCents, order.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4 ml-auto max-w-xs space-y-1.5 text-[13px]">
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
        <Row label="VAT" value={formatMoney(order.taxCents, order.currency)} />
        <div className="flex justify-between border-t border-line pt-2 font-medium">
          <dt>Total</dt>
          <dd className="tabular">{formatMoney(order.totalCents, order.currency)}</dd>
        </div>
        {order.refundedCents > 0 ? (
          <Row label="Refunded" value={`−${formatMoney(order.refundedCents, order.currency)}`} />
        ) : null}
      </dl>

      <footer className="mt-10 border-t border-line pt-4 text-[11.5px] leading-relaxed text-muted">
        {paidPayment ? (
          <p>
            Paid by {paidPayment.methodBrand ? `${paidPayment.methodBrand} ending ${paidPayment.methodLast4}` : "card"}{" "}
            · reference <span className="font-mono">{paidPayment.providerRef}</span>
          </p>
        ) : (
          <p>Awaiting payment.</p>
        )}
        <p className="mt-2">
          Placeholder VAT and company details — these must be replaced with the real trading entity&rsquo;s
          registration before this invoice is issued to a customer.
        </p>
      </footer>
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
