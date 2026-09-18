import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission, can } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { AdminFilters } from "@/components/admin/admin-filters";
import { StockAdjuster } from "@/components/admin/stock-adjuster";

export const metadata: Metadata = { title: "Inventory", robots: { index: false, follow: false } };

const PER_PAGE = 30;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  await requirePermission("inventory:read");
  const params = await searchParams;
  const canWrite = await can("inventory:write");

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const variants = await prisma.productVariant.findMany({
    where: {
      deletedAt: null,
      ...(params.q
        ? {
            OR: [
              { sku: { contains: params.q, mode: "insensitive" as const } },
              { product: { title: { contains: params.q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: [{ product: { title: "asc" } }, { position: "asc" }],
    take: PER_PAGE * 4,
    include: {
      product: { select: { id: true, title: true, slug: true, status: true } },
      inventory: { select: { onHand: true, reserved: true, warehouse: { select: { name: true, code: true } } } },
    },
  });

  // Availability is derived, so filtering happens after the roll-up rather than
  // in SQL — the catalogue is small enough that this stays cheap and honest.
  const rows = variants
    .map((variant) => {
      const onHand = variant.inventory.reduce((total, item) => total + item.onHand, 0);
      const reserved = variant.inventory.reduce((total, item) => total + item.reserved, 0);
      return { variant, onHand, reserved, available: onHand - reserved };
    })
    .filter((row) => {
      if (params.filter === "low") return row.available > 0 && row.available <= row.variant.lowStockThreshold;
      if (params.filter === "out") return row.available <= 0;
      if (params.filter === "reserved") return row.reserved > 0;
      return true;
    });

  const paged = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pageCount = Math.ceil(rows.length / PER_PAGE);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="On hand, reserved for in-flight orders, and what is actually sellable."
      />

      <AdminFilters
        searchPlaceholder="SKU or product"
        filters={[
          {
            key: "filter",
            label: "Show",
            options: [
              { value: "", label: "All variants" },
              { value: "low", label: "Low stock" },
              { value: "out", label: "Out of stock" },
              { value: "reserved", label: "Has reservations" },
            ],
          },
        ]}
      />

      <Panel className="mt-4">
        {paged.length === 0 ? (
          <EmptyState title="Nothing to show" description="Adjust the filters to see more variants." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th>Warehouse</Th>
                <Th align="right">On hand</Th>
                <Th align="right">Reserved</Th>
                <Th align="right">Available</Th>
                {canWrite ? <Th align="right">Adjust</Th> : null}
              </tr>
            </thead>
            <tbody>
              {paged.map(({ variant, onHand, reserved, available }) => {
                const low = available > 0 && available <= variant.lowStockThreshold;
                return (
                  <tr key={variant.id} className="hover:bg-paper-deep">
                    <Td>
                      <Link
                        href={`/admin/products/${variant.product.id}`}
                        className="block max-w-[16rem] truncate font-medium hover:underline"
                      >
                        {variant.product.title}
                      </Link>
                      <span className="block text-[11.5px] text-muted">{variant.title}</span>
                    </Td>
                    <Td className="font-mono text-[11.5px]">{variant.sku}</Td>
                    <Td className="text-[12px] text-muted">
                      {variant.inventory.map((item) => item.warehouse.code).join(", ") || "—"}
                    </Td>
                    <Td align="right" className="tabular">
                      {onHand}
                    </Td>
                    <Td align="right" className="tabular text-muted">
                      {reserved}
                    </Td>
                    <Td
                      align="right"
                      className={`tabular font-medium ${available <= 0 ? "text-danger" : low ? "text-warning" : ""}`}
                    >
                      {available}
                      {low ? <span className="block text-[10.5px] font-normal">low</span> : null}
                    </Td>
                    {canWrite ? (
                      <Td align="right">
                        <StockAdjuster variantId={variant.id} sku={variant.sku} available={available} />
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex justify-center gap-1">
          {Array.from({ length: Math.min(pageCount, 12) }, (_, index) => index + 1).map((entry) => {
            const next = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
              if (value && key !== "page") next.set(key, String(value));
            }
            if (entry > 1) next.set("page", String(entry));
            return (
              <Link
                key={entry}
                href={`/admin/inventory${next.toString() ? `?${next}` : ""}`}
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
