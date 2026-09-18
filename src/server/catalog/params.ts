import type { CatalogFilters, SortKey } from "./types";

/**
 * URL <-> filter mapping.
 *
 * Filters live in the query string so a filtered collection is linkable,
 * shareable and back-button friendly. Everything is parsed defensively: an
 * unknown sort key or a non-numeric price falls back rather than throwing.
 */

export type SearchParamsInput = Record<string, string | string[] | undefined>;

const SORT_KEYS: SortKey[] = ["relevance", "newest", "price-asc", "price-desc", "rating", "popular"];

const RESERVED = new Set(["sort", "page", "q", "brand", "min", "max", "rating", "stock", "sale", "per"]);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : value.split(",");
  return values.map((entry) => entry.trim()).filter(Boolean).slice(0, 20);
}

function positiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function parseCollectionParams(
  params: SearchParamsInput,
  defaults: { categorySlug?: string; query?: string } = {},
): { filters: CatalogFilters; sort: SortKey; page: number; perPage: number } {
  const sortParam = first(params.sort) as SortKey | undefined;
  const sort = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : defaults.query ? "relevance" : "newest";

  const attributes: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (RESERVED.has(key)) continue;
    // Attribute filters arrive as attr_<key>=value,value
    if (!key.startsWith("attr_")) continue;
    const attributeKey = key.slice(5);
    const values = list(value);
    if (attributeKey && values.length > 0) attributes[attributeKey] = values;
  }

  // Prices are expressed in whole currency units in the URL, minor units inside.
  const min = positiveInt(first(params.min));
  const max = positiveInt(first(params.max));

  return {
    filters: {
      categorySlug: defaults.categorySlug,
      query: defaults.query ?? first(params.q),
      brandSlugs: list(params.brand),
      minPriceCents: min !== undefined ? min * 100 : undefined,
      maxPriceCents: max !== undefined ? max * 100 : undefined,
      minRating: positiveInt(first(params.rating)),
      inStockOnly: first(params.stock) === "1",
      onSaleOnly: first(params.sale) === "1",
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    },
    sort,
    page: Math.max(1, positiveInt(first(params.page)) ?? 1),
    perPage: Math.min(48, positiveInt(first(params.per)) ?? 24),
  };
}

/** True when anything narrows the collection — drives the "clear all" affordance. */
export function hasActiveFilters(filters: CatalogFilters): boolean {
  return Boolean(
    filters.brandSlugs?.length ||
      filters.minPriceCents !== undefined ||
      filters.maxPriceCents !== undefined ||
      filters.minRating ||
      filters.inStockOnly ||
      filters.onSaleOnly ||
      (filters.attributes && Object.keys(filters.attributes).length > 0),
  );
}
