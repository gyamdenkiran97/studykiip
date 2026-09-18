/** Shapes shared between catalog queries and the components that render them. */

export type ProductCard = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  brand: { name: string; slug: string } | null;
  primaryImage: { url: string; alt: string } | null;
  secondaryImage: { url: string; alt: string } | null;
  priceCents: number;
  compareAtCents: number | null;
  currency: string;
  ratingAverage: number;
  ratingCount: number;
  inStock: boolean;
  isLowStock: boolean;
  variantCount: number;
  defaultVariantId: string | null;
  tags: string[];
};

export type SortKey = "relevance" | "newest" | "price-asc" | "price-desc" | "rating" | "popular";

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "relevance", label: "Most relevant" },
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Highest rated" },
  { value: "popular", label: "Best selling" },
];

export type CatalogFilters = {
  categorySlug?: string;
  brandSlugs?: string[];
  query?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  minRating?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  /** attribute key -> selected values */
  attributes?: Record<string, string[]>;
};

export type FacetValue = { value: string; label: string; count: number };

export type CatalogFacets = {
  brands: FacetValue[];
  categories: FacetValue[];
  attributes: Array<{ key: string; label: string; values: FacetValue[] }>;
  priceRange: { minCents: number; maxCents: number };
  availability: { inStock: number; onSale: number };
};

export type CatalogPage = {
  items: ProductCard[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};
