import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Package, Heart } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { listOrdersForUser } from "@/server/orders";
import { prisma } from "@/server/db";
import { formatMoney } from "@/lib/money";
import type { OrderStatus } from "@/server/orders/state-machine";
import { OrderStatusPill } from "@/components/account/order-status-pill";

export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const actor = await requireActor();
  const [{ orders, total }, addressCount, wishlistCount] = await Promise.all([
    listOrdersForUser(actor.id, { take: 3 }),
    prisma.address.count({ where: { userId: actor.id, deletedAt: null } }),
    prisma.wishlistItem.count({ where: { wishlist: { userId: actor.id } } }),
  ]);

  return (
    <div>
      <h1 className="text-display-3">Overview</h1>
      <p className="mt-2 text-[14.5px] text-muted">
        Everything about your orders, addresses and saved items in one place.
      </p>

      <div className="mt-8 grid gap-px bg-line sm:grid-cols-3">
        <Stat icon={<Package size={17} strokeWidth={1.5} />} label="Orders" value={total} href="/account/orders" />
        <Stat icon={<MapPin size={17} strokeWidth={1.5} />} label="Addresses" value={addressCount} href="/account/addresses" />
        <Stat icon={<Heart size={17} strokeWidth={1.5} />} label="Saved items" value={wishlistCount} href="/wishlist" />
      </div>

      <section className="mt-12" aria-labelledby="recent-orders">
        <div className="flex items-baseline justify-between">
          <h2 id="recent-orders" className="font-display text-xl">
            Recent orders
          </h2>
          {total > 0 ? (
            <Link href="/account/orders" className="text-[13px] text-muted underline underline-offset-4 hover:text-ink">
              View all
            </Link>
          ) : null}
        </div>

        {orders.length === 0 ? (
          <p className="mt-4 text-[14px] text-muted">
            You have not placed an order yet.{" "}
            <Link href="/shop" className="underline underline-offset-4 hover:text-ink">
              Start browsing
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={`/account/orders/${order.id}`} className="flex items-center gap-4 py-4 hover:bg-paper-deep">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[12.5px] text-muted">{order.orderNumber}</p>
                    <p className="mt-1 truncate text-[14px]">
                      {order.items.map((item) => item.productTitle).join(", ")}
                    </p>
                  </div>
                  <OrderStatusPill status={order.status as OrderStatus} />
                  <span className="tabular hidden text-[14px] sm:block">
                    {formatMoney(order.totalCents, order.currency)}
                  </span>
                  <ArrowRight size={15} strokeWidth={1.6} className="text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="group bg-paper p-5 transition-colors hover:bg-paper-deep">
      <span className="flex items-center gap-2 text-muted">{icon}</span>
      <p className="tabular mt-3 font-display text-3xl">{value}</p>
      <p className="mt-1 text-[13px] text-muted">{label}</p>
    </Link>
  );
}
