import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { ROLE_LABELS, type Role } from "@/server/auth/permissions";
import type { OrderStatus } from "@/server/orders/state-machine";
import { OrderStatusPill } from "@/components/account/order-status-pill";
import { PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { CustomerAdminActions } from "@/components/admin/customer-admin-actions";

export const metadata: Metadata = { title: "Customer", robots: { index: false, follow: false } };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("customer:read");
  const { id } = await params;

  const [user, canWrite, canChangeRole] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        addresses: { where: { deletedAt: null } },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalCents: true,
            currency: true,
            createdAt: true,
          },
        },
        reviews: { select: { id: true, status: true } },
        _count: { select: { orders: true } },
      },
    }),
    can("customer:write"),
    can("user:role:write"),
  ]);

  if (!user) notFound();

  const paidOrders = user.orders.filter((order) =>
    ["PAID", "PROCESSING", "PACKING", "SHIPPED", "DELIVERED", "PARTIALLY_REFUNDED"].includes(order.status),
  );
  const lifetime = paidOrders.reduce((total, order) => total + order.totalCents, 0);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Customers", href: "/admin/customers" }, { label: user.name }]}
        title={user.name}
        description={`${user.email} · ${ROLE_LABELS[user.role as Role]} · joined ${user.createdAt.toLocaleDateString("en-GB", { dateStyle: "long" })}`}
      />

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          <Panel title="Orders" description={`${user._count.orders} in total.`}>
            {user.orders.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-muted">No orders yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Placed</Th>
                    <Th>Status</Th>
                    <Th align="right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {user.orders.map((order) => (
                    <tr key={order.id} className="hover:bg-paper-deep">
                      <Td>
                        <Link href={`/admin/orders/${order.id}`} className="font-mono text-[12px] hover:underline">
                          {order.orderNumber}
                        </Link>
                      </Td>
                      <Td className="tabular text-[12px] text-muted">
                        {order.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
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

          <Panel title="Addresses">
            {user.addresses.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-muted">No saved addresses.</p>
            ) : (
              <ul className="grid gap-4 p-5 sm:grid-cols-2">
                {user.addresses.map((address) => (
                  <li key={address.id} className="border border-line p-4 text-[12.5px] leading-relaxed">
                    <p className="font-medium">{address.fullName}</p>
                    <address className="text-muted not-italic">
                      {[address.line1, address.line2, address.city, address.region, address.postalCode, address.countryCode]
                        .filter(Boolean)
                        .join(", ")}
                    </address>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Summary">
            <dl className="space-y-2 px-5 py-4 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted">Lifetime value</dt>
                <dd className="tabular font-medium">{formatMoney(lifetime)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Paid orders</dt>
                <dd className="tabular">{paidOrders.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Reviews</dt>
                <dd className="tabular">{user.reviews.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Email verified</dt>
                <dd>{user.emailVerified ? "Yes" : "No"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Last sign-in</dt>
                <dd className="tabular">
                  {user.lastLoginAt
                    ? user.lastLoginAt.toLocaleDateString("en-GB", { dateStyle: "medium" })
                    : "Never"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Marketing</dt>
                <dd>{user.marketingOptIn ? "Opted in" : "Opted out"}</dd>
              </div>
            </dl>
          </Panel>

          {canWrite ? (
            <CustomerAdminActions
              userId={user.id}
              status={user.status}
              role={user.role as Role}
              adminNotes={user.adminNotes}
              canChangeRole={canChangeRole}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
