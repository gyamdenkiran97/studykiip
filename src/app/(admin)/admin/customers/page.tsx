import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { ROLE_LABELS, type Role } from "@/server/auth/permissions";
import { EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { AdminFilters } from "@/components/admin/admin-filters";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Customers", robots: { index: false, follow: false } };

const PER_PAGE = 25;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  await requirePermission("customer:read");
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const where = {
    deletedAt: null,
    ...(params.role ? { role: params.role as Role } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" as const } },
            { email: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        orders: { select: { totalCents: true, currency: true, status: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <>
      <PageHeader title="Customers" description={`${total} ${total === 1 ? "account" : "accounts"}.`} />

      <AdminFilters
        searchPlaceholder="Name or email"
        filters={[
          {
            key: "role",
            label: "Role",
            options: [
              { value: "", label: "All roles" },
              { value: "CUSTOMER", label: "Customers" },
              { value: "STAFF", label: "Staff" },
              { value: "MANAGER", label: "Managers" },
              { value: "ADMIN", label: "Administrators" },
              { value: "SUPER_ADMIN", label: "Super administrators" },
            ],
          },
        ]}
      />

      <Panel className="mt-4">
        {users.length === 0 ? (
          <EmptyState title="No accounts match" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th align="center">Orders</Th>
                <Th align="right">Lifetime value</Th>
                <Th>Joined</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                // Lifetime value counts orders that were actually paid for.
                const paid = user.orders.filter((order) =>
                  ["PAID", "PROCESSING", "PACKING", "SHIPPED", "DELIVERED", "PARTIALLY_REFUNDED"].includes(
                    order.status,
                  ),
                );
                const lifetime = paid.reduce((total, order) => total + order.totalCents, 0);

                return (
                  <tr key={user.id} className="hover:bg-paper-deep">
                    <Td>
                      <Link href={`/admin/customers/${user.id}`} className="block font-medium hover:underline">
                        {user.name}
                      </Link>
                      <span className="block text-[11.5px] text-muted">{user.email}</span>
                    </Td>
                    <Td className="text-[12.5px]">{ROLE_LABELS[user.role as Role]}</Td>
                    <Td align="center" className="tabular">
                      {paid.length}
                    </Td>
                    <Td align="right" className="tabular">
                      {formatMoney(lifetime)}
                    </Td>
                    <Td className="tabular text-[12px] text-muted">
                      {user.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                    </Td>
                    <Td>
                      <Badge tone={user.status === "ACTIVE" ? "success" : "danger"}>
                        {user.status.toLowerCase()}
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
