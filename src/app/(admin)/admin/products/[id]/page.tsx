import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getEditorReferenceData } from "@/server/catalog/admin-queries";
import { toMoneyInput } from "@/lib/money";
import { PageHeader } from "@/components/admin/ui";
import { ProductEditor } from "@/components/admin/product-editor";

export const metadata: Metadata = { title: "Edit product", robots: { index: false, follow: false } };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("product:write");
  const { id } = await params;

  const [product, reference] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        categories: { select: { categoryId: true, isPrimary: true } },
        attributes: { include: { definition: { select: { key: true } } } },
        variants: {
          where: { deletedAt: null },
          orderBy: { position: "asc" },
          include: { inventory: { select: { onHand: true, reserved: true } } },
        },
      },
    }),
    getEditorReferenceData(),
  ]);

  if (!product) notFound();

  const attributes: Record<string, string> = {};
  for (const attribute of product.attributes) {
    attributes[attribute.definition.key] = attribute.value;
  }

  // The primary category comes first: the editor treats position as meaning.
  const categoryIds = [...product.categories]
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((entry) => entry.categoryId);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Products", href: "/admin/products" }, { label: product.title }]}
        title={product.title}
        description={`Last updated ${product.updatedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`}
        actions={
          <Link
            href={`/product/${product.slug}`}
            className="inline-flex h-9 items-center border border-line-strong px-3 text-[13px] hover:border-ink"
          >
            View in store
          </Link>
        }
      />

      <ProductEditor
        initial={{
          id: product.id,
          title: product.title,
          slug: product.slug,
          shortDescription: product.shortDescription ?? "",
          description: product.description,
          brandId: product.brandId,
          taxClassId: product.taxClassId,
          categoryIds,
          status: product.status,
          isFeatured: product.isFeatured,
          tags: product.tags,
          metaTitle: product.metaTitle ?? "",
          metaDescription: product.metaDescription ?? "",
          attributes,
          variants: product.variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            title: variant.title,
            price: toMoneyInput(variant.priceCents, variant.currency),
            salePrice: variant.salePriceCents === null ? "" : toMoneyInput(variant.salePriceCents, variant.currency),
            costPrice: variant.costPriceCents === null ? "" : toMoneyInput(variant.costPriceCents, variant.currency),
            weightGrams: variant.weightGrams === null ? "" : String(variant.weightGrams),
            lowStockThreshold: String(variant.lowStockThreshold),
            allowBackorder: variant.allowBackorder,
            isActive: variant.isActive,
            initialStock: "0",
            stockOnHand: variant.inventory.reduce((total, item) => total + item.onHand - item.reserved, 0),
          })),
        }}
        brands={reference.brands}
        categories={reference.categories}
        taxClasses={reference.taxClasses}
        attributeDefinitions={reference.attributeDefinitions}
      />
    </>
  );
}
