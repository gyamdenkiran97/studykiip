import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getFacets, listProducts } from "@/server/catalog/queries";
import { getWishlistProductIds } from "@/server/wishlist";
import { hasActiveFilters } from "@/server/catalog/params";
import type { CatalogFilters, SortKey } from "@/server/catalog/types";
import { ProductGrid } from "../product-grid";
import { ActiveFilterChips, FilterDrawer, FilterRail, SortSelect } from "./filter-controls";
import { Pagination } from "./pagination";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

/**
 * Shared collection view used by /shop, /category/[slug], /brand/[slug] and
 * /search. Everything below the heading — facets, sorting, pagination — behaves
 * identically wherever products are listed.
 */
export async function CollectionView({
  breadcrumbs,
  title,
  description,
  filters,
  sort,
  page,
  perPage,
  basePath,
  emptyState,
  children,
}: {
  breadcrumbs: Array<{ name: string; href: string }>;
  title: string;
  description?: string | null;
  filters: CatalogFilters;
  sort: SortKey;
  page: number;
  perPage: number;
  basePath: string;
  emptyState?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [result, facets, wishlisted] = await Promise.all([
    listProducts({ filters, sort, page, perPage }),
    getFacets(filters),
    getWishlistProductIds(),
  ]);

  const activeCount =
    (filters.brandSlugs?.length ?? 0) +
    (filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.onSaleOnly ? 1 : 0) +
    Object.values(filters.attributes ?? {}).reduce((total, values) => total + values.length, 0);

  return (
    <div className="shell pt-6 pb-20">
      <BreadcrumbJsonLd items={breadcrumbs} />

      <nav aria-label="Breadcrumb" className="mb-7">
        <ol className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.href} className="flex items-center gap-1.5">
              {index > 0 ? <ChevronRight size={13} strokeWidth={1.6} aria-hidden="true" /> : null}
              {index === breadcrumbs.length - 1 ? (
                <span aria-current="page" className="text-ink-soft">
                  {crumb.name}
                </span>
              ) : (
                <Link href={crumb.href} className="transition-colors hover:text-ink">
                  {crumb.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <header className="max-w-2xl">
        <h1 className="text-display-2">{title}</h1>
        {description ? <p className="mt-4 text-[15px] leading-relaxed text-muted">{description}</p> : null}
      </header>

      {children}

      <div className="mt-10 grid gap-x-10 lg:grid-cols-[236px_1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <FilterRail facets={facets} />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <p className="tabular text-[13px] text-muted" aria-live="polite">
              {result.total} {result.total === 1 ? "product" : "products"}
            </p>
            <div className="flex items-center gap-3">
              <FilterDrawer facets={facets} activeCount={activeCount} />
              <SortSelect value={sort} />
            </div>
          </div>

          {activeCount > 0 ? (
            <div className="py-4">
              <ActiveFilterChips facets={facets} />
            </div>
          ) : null}

          {result.items.length === 0 ? (
            <div className="py-20 text-center">
              {emptyState ?? (
                <>
                  <p className="font-display text-xl">Nothing matches those filters</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                    {hasActiveFilters(filters)
                      ? "Try removing a filter, or widen the price range."
                      : "This collection is empty for now."}
                  </p>
                  <Link
                    href={basePath}
                    className="mt-5 inline-block text-[13px] underline underline-offset-4 hover:text-clay"
                  >
                    Clear filters
                  </Link>
                </>
              )}
            </div>
          ) : (
            <>
              <ProductGrid products={result.items} wishlisted={wishlisted} columns={4} className="mt-8" />
              <Pagination page={result.page} pageCount={result.pageCount} total={result.total} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
