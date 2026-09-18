import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrandBySlug } from "@/server/catalog/queries";
import { CollectionView } from "@/components/storefront/collection/collection-view";
import { parseCollectionParams, type SearchParamsInput } from "@/server/catalog/params";
import { prisma } from "@/server/db";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) return { title: "Brand not found" };

  return {
    title: brand.metaTitle ?? brand.name,
    description: brand.metaDescription ?? brand.description ?? undefined,
    alternates: { canonical: `/brand/${brand.slug}` },
  };
}

export async function generateStaticParams() {
  const brands = await prisma.brand.findMany({
    where: { isActive: true, deletedAt: null },
    select: { slug: true },
  });
  return brands.map((brand) => ({ slug: brand.slug }));
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const parsed = parseCollectionParams(query);
  // The brand is fixed by the route, so it is not an editable filter here.
  const filters = { ...parsed.filters, brandSlugs: [brand.slug] };

  return (
    <CollectionView
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Brands", href: "/shop" },
        { name: brand.name, href: `/brand/${brand.slug}` },
      ]}
      title={brand.name}
      description={brand.description}
      filters={filters}
      sort={parsed.sort}
      page={parsed.page}
      perPage={parsed.perPage}
      basePath={`/brand/${brand.slug}`}
    />
  );
}
