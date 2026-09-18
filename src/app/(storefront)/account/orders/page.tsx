import type { Metadata } from "next";
import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { listOrdersForUser } from "@/server/orders";
import { formatMoney } from "@/lib/money";
import type { OrderStatus } from "@/server/orders/state-machine";
import { OrderStatusPill } from "@/components/account/order-status-pill";
import { ProductImage } from "@/components/ui/product-image";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Your orders", robots: { index: false, follow: false } };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const perPage = 10;

  const actor = await requireActor();
  const { orders, total } = await listOrdersForUser(actor.id, {
    take: perPage,
    skip: (page - 1) * perPage,
  });

  const pageCount = Math.ceil(total / perPage);

  return (
    <div>
      <h1 className="text-display-3">Orders</h1>
      <p className="mt-2 text-[14.5px] text-muted">
        {total === 0 ? "No orders yet." : `${total} ${total === 1 ? "order" : "orders"}`}
      </p>

      {orders.length === 0 ? (
        <div className="mt-10 border border-line p-10 text-center">
          <p className="font-display text-xl">Nothing here yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            When you place an order it will appear here with tracking and your invoice.
          </p>
          <Button asChild className="mt-6">
            <Link href="/shop">Start browsing</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="border border-line">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper-deep px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12.5px]">
                  <span>
                    <span className="block text-muted">Order</span>
                    <span className="font-mono">{order.orderNumber}</span>
                  </span>
                  <span>
                    <span className="block text-muted">Placed</span>
                    <time dateTime={order.createdAt.toISOString()}>
                      {order.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </time>
                  </span>
                  <span>
                    <span className="block text-muted">Total</span>
                    <span className="tabular">{formatMoney(order.totalCents, order.currency)}</span>
                  </span>
                </div>
                <OrderStatusPill status={order.status as OrderStatus} />
              </div>

              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <ul className="flex flex-1 flex-wrap gap-2">
                  {order.items.slice(0, 5).map((item) => (
                    <li key={item.id} className="relative h-16 w-13 overflow-hidden bg-paper-deep">
                      <ProductImage src={item.imageUrl} alt={item.productTitle} sizes="52px" />
                    </li>
                  ))}
                  {order.items.length > 5 ? (
                    <li className="grid h-16 w-13 place-items-center bg-paper-deep text-[12px] text-muted">
                      +{order.items.length - 5}
                    </li>
                  ) : null}
                </ul>

                <div className="flex gap-2">
                  {order.shipments[0]?.trackingUrl ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={order.shipments[0].trackingUrl} target="_blank" rel="noopener noreferrer">
                        Track parcel
                      </a>
                    </Button>
                  ) : null}
                  <Button asChild size="sm">
                    <Link href={`/account/orders/${order.id}`}>View order</Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Orders pagination" className="mt-8 flex justify-center gap-2">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((entry) => (
            <Link
              key={entry}
              href={`/account/orders?page=${entry}`}
              aria-current={entry === page ? "page" : undefined}
              className={`tabular grid h-9 min-w-9 place-items-center px-2 text-[13px] ${
                entry === page ? "bg-ink text-paper" : "text-muted hover:bg-paper-deep"
              }`}
            >
              {entry}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
