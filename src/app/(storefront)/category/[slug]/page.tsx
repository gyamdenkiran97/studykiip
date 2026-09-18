import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/server/catalog/queries";
import { CollectionView } from "@/components/storefront/collection/collection-view";
import { parseCollectionParams, type SearchParamsInput } from "@/server/catalog/params";
import { ProductImage } from "@/components/ui/product-image";
import { prisma } from "@/server/db";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };

  return {
    title: category.metaTitle ?? category.name,
    description: category.metaDescription ?? category.description ?? undefined,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: {
      title: category.metaTitle ?? category.name,
      description: category.metaDescription ?? category.description ?? undefined,
      images: category.imageUrl ? [category.imageUrl] : undefined,
    },
  };
}

/** Pre-render every category; there are few of them and they change rarely. */
export async function generateStaticParams() {
  const categories = await prisma.category.findMany({
    where: { isActive: true, deletedAt: null },
    select: { slug: true },
  });
  return categories.map((category) => ({ slug: category.slug }));
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const { filters, sort, page, perPage } = parseCollectionParams(query, { categorySlug: slug });

  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: "Shop", href: "/shop" },
    ...(category.parent ? [{ name: category.parent.name, href: `/category/${category.parent.slug}` }] : []),
    { name: category.name, href: `/category/${category.slug}` },
  ];

  return (
    <CollectionView
      breadcrumbs={breadcrumbs}
      title={category.name}
      description={category.description}
      filters={filters}
      sort={sort}
      page={page}
      perPage={perPage}
      basePath={`/category/${category.slug}`}
    >
      {category.children.length > 0 ? (
        <nav aria-label={`${category.name} sections`} className="no-scrollbar mt-8 flex gap-3 overflow-x-auto">
          {category.children.map((child) => (
            <Link
              key={child.slug}
              href={`/category/${child.slug}`}
              className="group w-40 shrink-0"
            >
              <div className="relative aspect-4/3 overflow-hidden bg-paper-deep">
                <ProductImage
                  src={child.imageUrl}
                  alt={child.imageAlt ?? ""}
                  sizes="160px"
                  className="transition-transform duration-500 group-hover:scale-[1.05]"
                />
              </div>
              <p className="mt-2 text-[13px] text-ink-soft transition-colors group-hover:text-ink">{child.name}</p>
            </Link>
          ))}
        </nav>
      ) : null}
    </CollectionView>
  );
}
