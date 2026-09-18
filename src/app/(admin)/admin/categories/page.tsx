import type { Metadata } from "next";
import { requirePermission, can } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/admin/ui";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata: Metadata = { title: "Categories", robots: { index: false, follow: false } };

export default async function CategoriesPage() {
  await requirePermission("product:read");
  const canWrite = await can("category:write");

  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parentId: true,
      position: true,
      isActive: true,
      isFeatured: true,
      imageUrl: true,
      metaTitle: true,
      metaDescription: true,
      _count: { select: { products: true, children: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Categories"
        description="The department tree. Any depth is allowed; the storefront shows two levels in the menu."
      />
      <CategoryManager
        canWrite={canWrite}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          parentId: category.parentId,
          position: category.position,
          isActive: category.isActive,
          isFeatured: category.isFeatured,
          imageUrl: category.imageUrl ?? "",
          metaTitle: category.metaTitle ?? "",
          metaDescription: category.metaDescription ?? "",
          productCount: category._count.products,
          childCount: category._count.children,
        }))}
      />
    </>
  );
}
