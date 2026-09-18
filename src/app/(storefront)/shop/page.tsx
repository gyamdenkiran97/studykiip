import type { Metadata } from "next";
import { CollectionView } from "@/components/storefront/collection/collection-view";
import { parseCollectionParams, type SearchParamsInput } from "@/server/catalog/params";

export const metadata: Metadata = {
  title: "Shop everything",
  description:
    "Every product in the mall: fashion, electronics, beauty, home, furniture, sport, accessories, food, toys, office and automotive.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const { filters, sort, page, perPage } = parseCollectionParams(params);

  return (
    <CollectionView
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Shop", href: "/shop" },
      ]}
      title="Everything in the mall"
      description="Eleven departments, one basket. Filter by department, brand, price and the attributes that matter to what you are buying."
      filters={filters}
      sort={sort}
      page={page}
      perPage={perPage}
      basePath="/shop"
    />
  );
}
