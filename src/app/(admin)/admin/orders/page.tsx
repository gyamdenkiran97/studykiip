import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/server/orders/state-machine";
import { OrderStatusPill } from "@/components/account/order-status-pill";
import { EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { AdminFilters } from "@/components/admin/admin-filters";

export const metadata: Metadata = { title: "Orders", robots: { index: false, follow: false } };

const PER_PAGE = 25;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requirePermission("order:read");
  const params = await searchParams;

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const status = ORDER_STATUSES.includes(params.status as OrderStatus) ? (params.status as OrderStatus) : undefined;
  const query = params.q?.trim();

  const where = {
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
            { user: { name: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [orders, total, statusCounts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalCents: true,
        refundedCents: true,
        currency: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        _count: { select: { items: true } },
        payments: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
  ]);

  const pageCount = Math.ceil(total / PER_PAGE);
  const counts = new Map(statusCounts.map((row) => [row.status, row._count]));

  return (
    <>
      <PageHeader title="Orders" description={`${total} matching ${total === 1 ? "order" : "orders"}.`} />

      <AdminFilters
        searchPlaceholder="Order number, customer or email"
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "", label: "All statuses" },
              ...ORDER_STATUSES.map((entry) => ({
                value: entry,
                label: `${ORDER_STATUS_LABELS[entry]} (${counts.get(entry) ?? 0})`,
              })),
            ],
          },
        ]}
      />

      <Panel className="mt-4">
        {orders.length === 0 ? (
          <EmptyState title="No orders match" description="Try clearing the filters." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Placed</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-paper-deep">
                  <Td>
                    <Link href={`/admin/orders/${order.id}`} className="font-mono text-[12px] hover:underline">
                      {order.orderNumber}
                    </Link>
                    <span className="mt-0.5 block text-[11.5px] text-muted">
                      {order._count.items} {order._count.items === 1 ? "item" : "items"}
                    </span>
                  </Td>
                  <Td>
                    <span className="block max-w-[14rem] truncate">{order.user.name}</span>
                    <span className="block max-w-[14rem] truncate text-[11.5px] text-muted">{order.user.email}</span>
                  </Td>
                  <Td className="tabular whitespace-nowrap text-muted">
                    {order.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                  </Td>
                  <Td>
                    <OrderStatusPill status={order.status as OrderStatus} />
                  </Td>
                  <Td className="text-[12px] text-muted">
                    {order.payments[0]?.status.toLowerCase().replace(/_/g, " ") ?? "—"}
                  </Td>
                  <Td align="right" className="tabular whitespace-nowrap">
                    {formatMoney(order.totalCents, order.currency)}
                    {order.refundedCents > 0 ? (
                      <span className="block text-[11.5px] text-clay">
                        −{formatMoney(order.refundedCents, order.currency)}
                      </span>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex justify-center gap-1">
          {Array.from({ length: Math.min(pageCount, 12) }, (_, index) => index + 1).map((entry) => {
            const next = new URLSearchParams();
            if (status) next.set("status", status);
            if (query) next.set("q", query);
            if (entry > 1) next.set("page", String(entry));
            return (
              <Link
                key={entry}
                href={`/admin/orders${next.toString() ? `?${next}` : ""}`}
                aria-current={entry === page ? "page" : undefined}
                className={`tabular grid h-8 min-w-8 place-items-center px-2 text-[12.5px] ${
                  entry === page ? "bg-ink text-paper" : "text-muted hover:bg-paper-deep"
                }`}
              >
                {entry}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </>
  );
}
