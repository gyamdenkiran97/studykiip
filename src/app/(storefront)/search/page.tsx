import type { Metadata } from "next";
import Link from "next/link";
import { CollectionView } from "@/components/storefront/collection/collection-view";
import { parseCollectionParams, type SearchParamsInput } from "@/server/catalog/params";
import { normaliseQuery, popularSearches, recordSearch } from "@/server/search/engine";
import { listProducts } from "@/server/catalog/queries";
import { trackServerEvent } from "@/server/analytics";

/**
 * Search results.
 *
 * Deliberately noindex: query-string permutations create thin, near-duplicate
 * pages that dilute the crawl budget without helping anyone.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}): Promise<Metadata> {
  const params = await searchParams;
  const query = normaliseQuery(String(params.q ?? ""));
  return {
    title: query ? `Search: ${query}` : "Search",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const query = normaliseQuery(String(params.q ?? ""));
  const { filters, sort, page, perPage } = parseCollectionParams(params, { query: query || undefined });

  if (!query) {
    const popular = await popularSearches();
    return (
      <div className="shell py-20 text-center">
        <h1 className="text-display-2">Search the mall</h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] text-muted">
          Use the search field in the header to look across every department, brand and product.
        </p>
        {popular.length > 0 ? (
          <div className="mt-8">
            <p className="eyebrow mb-3">Popular searches</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {popular.map((term) => (
                <li key={term}>
                  <Link
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="border border-line-strong px-3 py-1.5 text-[13px] hover:border-ink"
                  >
                    {term}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  // Record what was searched for and how well it did, for the admin's search report.
  const preview = await listProducts({ filters, sort, page: 1, perPage: 1 });
  await Promise.all([
    recordSearch(query, preview.total),
    trackServerEvent("search", { query, results: preview.total }),
  ]);

  return (
    <CollectionView
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Search", href: "/search" },
        { name: query, href: `/search?q=${encodeURIComponent(query)}` },
      ]}
      title={`Results for “${query}”`}
      description={null}
      filters={filters}
      sort={sort}
      page={page}
      perPage={perPage}
      basePath={`/search?q=${encodeURIComponent(query)}`}
      emptyState={
        <>
          <p className="font-display text-xl">No results for “{query}”</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Check the spelling, try a more general word, or browse the departments instead.
          </p>
          <Link href="/shop" className="mt-5 inline-block text-[13px] underline underline-offset-4 hover:text-clay">
            Browse everything
          </Link>
        </>
      }
    />
  );
}
