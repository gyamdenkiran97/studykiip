import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission, can } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { effectivePrice } from "@/server/pricing";
import { EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { AdminFilters } from "@/components/admin/admin-filters";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { ProductImage } from "@/components/ui/product-image";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Products", robots: { index: false, follow: false } };

const PER_PAGE = 25;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string; page?: string }>;
}) {
  await requirePermission("product:read");
  const params = await searchParams;
  const canWrite = await can("product:write");

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const status = ["DRAFT", "ACTIVE", "ARCHIVED"].includes(params.status ?? "")
    ? (params.status as "DRAFT" | "ACTIVE" | "ARCHIVED")
    : undefined;

  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(params.category ? { categories: { some: { category: { slug: params.category } } } } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" as const } },
            { variants: { some: { sku: { contains: params.q, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        isFeatured: true,
        updatedAt: true,
        brand: { select: { name: true } },
        media: { where: { variantId: null }, orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
        categories: { select: { category: { select: { name: true } } }, take: 2 },
        variants: {
          where: { deletedAt: null },
          select: {
            priceCents: true,
            salePriceCents: true,
            currency: true,
            inventory: { select: { onHand: true, reserved: true } },
          },
        },
      },
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ parentId: "asc" }, { position: "asc" }],
      select: { slug: true, name: true, parentId: true },
    }),
  ]);

  const pageCount = Math.ceil(total / PER_PAGE);

  return (
    <>
      <PageHeader
        title="Products"
        description={`${total} ${total === 1 ? "product" : "products"} in the catalogue.`}
        actions={
          canWrite ? (
            <Link
              href="/admin/products/new"
              className="inline-flex h-9 items-center gap-1.5 bg-ink px-3.5 text-[13px] font-medium text-paper hover:bg-ink-soft"
            >
              <Plus size={15} strokeWidth={2} />
              New product
            </Link>
          ) : null
        }
      />

      <AdminFilters
        searchPlaceholder="Title or SKU"
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "", label: "All statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "DRAFT", label: "Draft" },
              { value: "ARCHIVED", label: "Archived" },
            ],
          },
          {
            key: "category",
            label: "Category",
            options: [
              { value: "", label: "All categories" },
              ...categories.map((category) => ({
                value: category.slug,
                label: category.parentId ? `— ${category.name}` : category.name,
              })),
            ],
          },
        ]}
      />

      <Panel className="mt-4">
        {products.length === 0 ? (
          <EmptyState
            title="No products match"
            description="Adjust the filters, or create a product."
            action={
              canWrite ? (
                <Link href="/admin/products/new" className="text-[13px] underline underline-offset-4">
                  New product
                </Link>
              ) : null
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th align="center">Variants</Th>
                <Th align="right">Price</Th>
                <Th align="right">Stock</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const prices = product.variants.map((variant) => effectivePrice(variant).unitPriceCents);
                const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
                const stock = product.variants.reduce(
                  (total, variant) =>
                    total + variant.inventory.reduce((sum, item) => sum + item.onHand - item.reserved, 0),
                  0,
                );

                return (
                  <tr key={product.id} className="hover:bg-paper-deep">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="relative block h-11 w-9 shrink-0 overflow-hidden bg-paper-deep">
                          <ProductImage src={product.media[0]?.url} alt="" sizes="36px" />
                        </span>
                        <span className="min-w-0">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="block max-w-[18rem] truncate font-medium hover:underline"
                          >
                            {product.title}
                          </Link>
                          <span className="block text-[11.5px] text-muted">
                            {product.brand?.name ?? "No brand"}
                            {product.isFeatured ? " · Featured" : ""}
                          </span>
                        </span>
                      </div>
                    </Td>
                    <Td className="text-[12.5px] text-muted">
                      {product.categories.map((entry) => entry.category.name).join(", ") || "—"}
                    </Td>
                    <Td align="center" className="tabular">
                      {product.variants.length}
                    </Td>
                    <Td align="right" className="tabular whitespace-nowrap">
                      {minPrice === maxPrice
                        ? formatMoney(minPrice)
                        : `${formatMoney(minPrice)}–${formatMoney(maxPrice)}`}
                    </Td>
                    <Td align="right" className={`tabular ${stock <= 0 ? "text-danger" : ""}`}>
                      {stock}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          product.status === "ACTIVE" ? "success" : product.status === "DRAFT" ? "quiet" : "out"
                        }
                      >
                        {product.status.toLowerCase()}
                      </Badge>
                    </Td>
                    <Td align="right">
                      {canWrite ? <ProductRowActions productId={product.id} slug={product.slug} status={product.status} /> : null}
                    </Td>
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
                href={`/admin/products${next.toString() ? `?${next}` : ""}`}
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
