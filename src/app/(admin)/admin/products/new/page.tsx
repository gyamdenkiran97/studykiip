import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { getEditorReferenceData } from "@/server/catalog/admin-queries";
import { PageHeader } from "@/components/admin/ui";
import { ProductEditor } from "@/components/admin/product-editor";

export const metadata: Metadata = { title: "New product", robots: { index: false, follow: false } };

export default async function NewProductPage() {
  await requirePermission("product:write");
  const reference = await getEditorReferenceData();

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Products", href: "/admin/products" }, { label: "New" }]}
        title="New product"
        description="Create it as a draft, then publish once the details and stock are right."
      />
      <ProductEditor
        initial={{
          title: "",
          slug: "",
          shortDescription: "",
          description: "",
          brandId: null,
          taxClassId: reference.taxClasses[0]?.id ?? null,
          categoryIds: [],
          status: "DRAFT",
          isFeatured: false,
          tags: [],
          metaTitle: "",
          metaDescription: "",
          attributes: {},
          variants: [
            {
              sku: "",
              title: "Standard",
              price: "",
              salePrice: "",
              costPrice: "",
              weightGrams: "",
              lowStockThreshold: "5",
              allowBackorder: false,
              isActive: true,
              initialStock: "0",
            },
          ],
        }}
        brands={reference.brands}
        categories={reference.categories}
        taxClasses={reference.taxClasses}
        attributeDefinitions={reference.attributeDefinitions}
      />
    </>
  );
}
