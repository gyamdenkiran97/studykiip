import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { EmptyState, PageHeader, Panel, StatTile, Table, Td, Th } from "@/components/admin/ui";
import { AdminFilters } from "@/components/admin/admin-filters";

export const metadata: Metadata = { title: "Payments", robots: { index: false, follow: false } };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requirePermission("payment:read");
  const params = await searchParams;

  const where = {
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.q
      ? {
          OR: [
            { providerRef: { contains: params.q, mode: "insensitive" as const } },
            { order: { orderNumber: { contains: params.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [payments, totals, refundTotal, webhookCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        order: { select: { id: true, orderNumber: true, email: true } },
        _count: { select: { events: true } },
      },
    }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true }, _count: true }),
    prisma.refund.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true } }),
    prisma.paymentEvent.count(),
  ]);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Provider references and the webhook events behind each one. Card details are never stored here."
      />

      <div className="grid gap-px bg-line sm:grid-cols-3">
        <StatTile label="Captured" value={formatMoney(totals._sum.amountCents ?? 0)} sublabel={`${totals._count} payments`} />
        <StatTile label="Refunded" value={formatMoney(refundTotal._sum.amountCents ?? 0)} />
        <StatTile label="Webhook events" value={String(webhookCount)} sublabel="deduplicated by provider id" />
      </div>

      <div className="mt-4">
        <AdminFilters
          searchPlaceholder="Order number or provider reference"
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "", label: "All statuses" },
                { value: "SUCCEEDED", label: "Succeeded" },
                { value: "REQUIRES_PAYMENT", label: "Awaiting payment" },
                { value: "PROCESSING", label: "Processing" },
                { value: "FAILED", label: "Failed" },
                { value: "REFUNDED", label: "Refunded" },
                { value: "PARTIALLY_REFUNDED", label: "Partially refunded" },
              ],
            },
          ]}
        />
      </div>

      <Panel className="mt-4">
        {payments.length === 0 ? (
          <EmptyState title="No payments match" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Provider reference</Th>
                <Th>Status</Th>
                <Th>Method</Th>
                <Th align="center">Events</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-paper-deep">
                  <Td>
                    <Link href={`/admin/orders/${payment.order.id}`} className="font-mono text-[12px] hover:underline">
                      {payment.order.orderNumber}
                    </Link>
                    <span className="block max-w-[14rem] truncate text-[11.5px] text-muted">
                      {payment.order.email}
                    </span>
                  </Td>
                  <Td className="max-w-[16rem] truncate font-mono text-[11.5px]">{payment.providerRef}</Td>
                  <Td className="text-[12.5px]">{payment.status.toLowerCase().replace(/_/g, " ")}</Td>
                  <Td className="text-[12.5px] text-muted">
                    {payment.methodBrand ? `${payment.methodBrand} ···· ${payment.methodLast4}` : payment.provider}
                  </Td>
                  <Td align="center" className="tabular">
                    {payment._count.events}
                  </Td>
                  <Td align="right" className="tabular">
                    {formatMoney(payment.amountCents, payment.currency)}
                    {payment.refundedCents > 0 ? (
                      <span className="block text-[11.5px] text-clay">
                        −{formatMoney(payment.refundedCents, payment.currency)}
                      </span>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
