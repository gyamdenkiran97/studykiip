import type { Metadata } from "next";
import { requirePermission, can } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/admin/ui";
import { BrandManager } from "@/components/admin/brand-manager";

export const metadata: Metadata = { title: "Brands", robots: { index: false, follow: false } };

export default async function BrandsPage() {
  await requirePermission("product:read");
  const canWrite = await can("brand:write");

  const brands = await prisma.brand.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      websiteUrl: true,
      isFeatured: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });

  return (
    <>
      <PageHeader title="Brands" description="Brand pages are generated automatically from these records." />
      <BrandManager
        canWrite={canWrite}
        brands={brands.map((brand) => ({
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          description: brand.description ?? "",
          websiteUrl: brand.websiteUrl ?? "",
          isFeatured: brand.isFeatured,
          isActive: brand.isActive,
          productCount: brand._count.products,
        }))}
      />
    </>
  );
}
