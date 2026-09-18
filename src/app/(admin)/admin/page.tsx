import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, PackageCheck, RotateCcw } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import {
  getBestSellers,
  getDashboardMetrics,
  getRecentOrders,
  getRevenueSeries,
} from "@/server/analytics/reports";
import { listLowStock } from "@/server/inventory";
import { formatMoney } from "@/lib/money";
import type { OrderStatus } from "@/server/orders/state-machine";
import { OrderStatusPill } from "@/components/account/order-status-pill";
import { EmptyState, PageHeader, Panel, StatTile, Table, Td, Th } from "@/components/admin/ui";
import { RevenueChart } from "@/components/admin/revenue-chart";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function AdminDashboard() {
  await requirePermission("dashboard:read");

  const [metrics, series, bestSellers, recentOrders, lowStock] = await Promise.all([
    getDashboardMetrics(30),
    getRevenueSeries(30),
    getBestSellers(6, 30),
    getRecentOrders(8),
    listLowStock(6),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="The last 30 days, compared with the 30 before it."
      />

      <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Revenue"
          value={formatMoney(metrics.revenueCents)}
          trend={{ value: metrics.change.revenue, label: "vs previous 30 days" }}
        />
        <StatTile
          label="Orders"
          value={String(metrics.orderCount)}
          trend={{ value: metrics.change.orders, label: "vs previous 30 days" }}
        />
        <StatTile
          label="Average order"
          value={formatMoney(metrics.averageOrderValueCents)}
          trend={{ value: metrics.change.aov, label: "vs previous 30 days" }}
        />
        <StatTile
          label="Refunded"
          value={formatMoney(metrics.refundedCents)}
          sublabel={`${metrics.newCustomers} new customers`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ActionCard
          href="/admin/orders?status=PAID"
          icon={<PackageCheck size={16} strokeWidth={1.6} />}
          label="Awaiting fulfilment"
          value={metrics.awaitingFulfilment}
        />
        <ActionCard
          href="/admin/orders?status=RETURN_REQUESTED"
          icon={<RotateCcw size={16} strokeWidth={1.6} />}
          label="Open returns"
          value={metrics.openReturns}
        />
        <ActionCard
          href="/admin/reviews"
          icon={<AlertTriangle size={16} strokeWidth={1.6} />}
          label="Reviews to moderate"
          value={metrics.pendingReviews}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Revenue" description="Daily totals for paid orders, net of nothing — refunds are shown separately.">
          <div className="p-5">
            <RevenueChart series={series} />
          </div>
        </Panel>

        <Panel title="Best sellers" description="By units, last 30 days.">
          {bestSellers.length === 0 ? (
            <EmptyState title="No sales yet" description="Once orders come in, your best sellers appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {bestSellers.map((product) => (
                <li key={product.sku} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {product.slug ? (
                        <Link href={`/product/${product.slug}`} className="hover:underline">
                          {product.title}
                        </Link>
                      ) : (
                        product.title
                      )}
                    </p>
                    <p className="font-mono text-[11px] text-muted">{product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-[13px] font-medium">{product.units} sold</p>
                    <p className="tabular text-[11.5px] text-muted">{formatMoney(product.revenueCents)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Recent orders"
          actions={
            <Link href="/admin/orders" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">
              All orders
              <ArrowUpRight size={13} strokeWidth={1.7} />
            </Link>
          }
        >
          {recentOrders.length === 0 ? (
            <EmptyState title="No orders yet" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-paper-deep">
                    <Td>
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-[12px] hover:underline">
                        {order.orderNumber}
                      </Link>
                      <span className="mt-0.5 block text-[11.5px] text-muted">
                        {order.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ·{" "}
                        {order._count.items} {order._count.items === 1 ? "item" : "items"}
                      </span>
                    </Td>
                    <Td>
                      <span className="block truncate">{order.user.name}</span>
                      <span className="block truncate text-[11.5px] text-muted">{order.user.email}</span>
                    </Td>
                    <Td>
                      <OrderStatusPill status={order.status as OrderStatus} />
                    </Td>
                    <Td align="right" className="tabular">
                      {formatMoney(order.totalCents, order.currency)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel
          title="Low stock"
          description="At or below the variant's threshold."
          actions={
            <Link href="/admin/inventory" className="text-[12.5px] text-muted hover:text-ink">
              Inventory
            </Link>
          }
        >
          {lowStock.length === 0 ? (
            <EmptyState title="Nothing running low" description="Every variant is above its threshold." />
          ) : (
            <ul className="divide-y divide-line">
              {lowStock.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">{item.variant.product.title}</p>
                    <p className="font-mono text-[11px] text-muted">{item.variant.sku}</p>
                  </div>
                  <span
                    className={`tabular text-[13px] font-medium ${item.available <= 0 ? "text-danger" : "text-warning"}`}
                  >
                    {item.available}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function ActionCard({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 border border-line bg-surface px-5 py-4 transition-colors hover:border-line-strong"
    >
      <span className="grid h-9 w-9 place-items-center bg-paper-deep text-ink-soft">{icon}</span>
      <span className="flex-1">
        <span className="block text-[13px] text-muted">{label}</span>
        <span className="tabular block font-display text-xl">{value}</span>
      </span>
      <ArrowUpRight size={15} strokeWidth={1.6} className="text-muted" aria-hidden="true" />
    </Link>
  );
}
