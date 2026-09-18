import "server-only";
import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";
import { effectivePrice } from "../pricing";
import { getSearchEngine } from "../search/engine";
import type { CatalogFacets, CatalogFilters, CatalogPage, ProductCard, SortKey } from "./types";

/**
 * Catalog reads.
 *
 * Listing uses one SQL statement to filter, sort and paginate on the server —
 * including a per-product price derived from its variants and live stock — and
 * then hydrates the page of ids through Prisma. Doing the arithmetic in the
 * database keeps the page size constant no matter how large the catalog grows.
 */

const PRODUCT_CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  tags: true,
  ratingAverageBps: true,
  ratingCount: true,
  brand: { select: { name: true, slug: true } },
  media: {
    where: { kind: "IMAGE" as const, variantId: null },
    orderBy: { position: "asc" as const },
    take: 2,
    select: { url: true, alt: true },
  },
  variants: {
    where: { isActive: true, deletedAt: null },
    orderBy: [{ isDefault: "desc" as const }, { position: "asc" as const }],
    select: {
      id: true,
      priceCents: true,
      salePriceCents: true,
      currency: true,
      allowBackorder: true,
      lowStockThreshold: true,
      inventory: { select: { onHand: true, reserved: true } },
    },
  },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_CARD_SELECT }>;

export function toProductCard(product: ProductRow): ProductCard {
  const variants = product.variants;
  const priced = variants.map((variant) => ({
    variant,
    ...effectivePrice(variant),
    available: variant.inventory.reduce((total, item) => total + item.onHand - item.reserved, 0),
  }));

  // The card advertises the cheapest buyable variant.
  const cheapest = priced.reduce<(typeof priced)[number] | null>(
    (best, current) => (best === null || current.unitPriceCents < best.unitPriceCents ? current : best),
    null,
  );

  const inStock = priced.some((entry) => entry.available > 0 || entry.variant.allowBackorder);
  const totalAvailable = priced.reduce((total, entry) => total + Math.max(0, entry.available), 0);
  const lowestThreshold = Math.max(...priced.map((entry) => entry.variant.lowStockThreshold), 0);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    shortDescription: product.shortDescription,
    brand: product.brand,
    primaryImage: product.media[0] ?? null,
    secondaryImage: product.media[1] ?? null,
    priceCents: cheapest?.unitPriceCents ?? 0,
    compareAtCents: cheapest?.compareAtCents ?? null,
    currency: cheapest?.variant.currency ?? "GBP",
    ratingAverage: product.ratingAverageBps / 100,
    ratingCount: product.ratingCount,
    inStock,
    isLowStock: inStock && totalAvailable > 0 && totalAvailable <= lowestThreshold,
    variantCount: variants.length,
    defaultVariantId: variants[0]?.id ?? null,
    tags: product.tags,
  };
}

/** Subquery giving each product its price envelope and stock state. */
const VARIANT_ROLLUP = Prisma.sql`
  SELECT pv."productId" AS product_id,
         MIN(COALESCE(pv."salePriceCents", pv."priceCents")) AS min_price,
         MAX(COALESCE(pv."salePriceCents", pv."priceCents")) AS max_price,
         BOOL_OR(COALESCE(inv.available, 0) > 0 OR pv."allowBackorder") AS in_stock,
         BOOL_OR(pv."salePriceCents" IS NOT NULL) AS on_sale
  FROM product_variants pv
  LEFT JOIN (
    SELECT "variantId", SUM("onHand" - reserved) AS available
    FROM inventory_items GROUP BY "variantId"
  ) inv ON inv."variantId" = pv.id
  WHERE pv."isActive" AND pv."deletedAt" IS NULL
  GROUP BY pv."productId"
`;

/** Every descendant of a category, so /category/fashion includes its children. */
function categoryScope(slug: string): Prisma.Sql {
  return Prisma.sql`
    EXISTS (
      WITH RECURSIVE tree AS (
        SELECT id FROM categories WHERE slug = ${slug} AND "deletedAt" IS NULL
        UNION ALL
        SELECT c.id FROM categories c JOIN tree t ON c."parentId" = t.id
      )
      SELECT 1 FROM product_categories pc
      JOIN tree ON tree.id = pc."categoryId"
      WHERE pc."productId" = p.id
    )`;
}

type ConditionOptions = {
  excludeBrands?: boolean;
  excludeAttribute?: string;
  /** Query terms already expanded with synonyms by the search engine. */
  searchTerms?: string[];
};

function buildConditions(filters: CatalogFilters, options: ConditionOptions = {}): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`p.status = 'ACTIVE'`,
    Prisma.sql`p."deletedAt" IS NULL`,
  ];

  if (filters.categorySlug) conditions.push(categoryScope(filters.categorySlug));

  if (!options.excludeBrands && filters.brandSlugs?.length) {
    conditions.push(Prisma.sql`b.slug = ANY(${filters.brandSlugs}::text[])`);
  }

  if (options.searchTerms?.length) {
    const terms = options.searchTerms;
    const patterns = terms.map((term) => `%${term}%`);
    const primary = terms[0];
    conditions.push(Prisma.sql`(
      p.title ILIKE ANY(${patterns}::text[])
      OR p."shortDescription" ILIKE ANY(${patterns}::text[])
      OR p.description ILIKE ${`%${primary}%`}
      OR b.name ILIKE ANY(${patterns}::text[])
      OR EXISTS (SELECT 1 FROM unnest(p.tags) tag WHERE tag ILIKE ANY(${patterns}::text[]))
      OR EXISTS (
        SELECT 1 FROM product_categories pc2
        JOIN categories c2 ON c2.id = pc2."categoryId"
        WHERE pc2."productId" = p.id AND c2.name ILIKE ANY(${patterns}::text[])
      )
      OR similarity(p.title, ${primary}) > 0.24
      OR EXISTS (SELECT 1 FROM unnest(p.tags) tag WHERE similarity(tag, ${primary}) > 0.4)
      OR similarity(COALESCE(b.name, ''), ${primary}) > 0.4
      OR EXISTS (SELECT 1 FROM product_variants pv2 WHERE pv2."productId" = p.id AND pv2.sku ILIKE ${`%${primary}%`})
    )`);
  }

  if (typeof filters.minPriceCents === "number") {
    conditions.push(Prisma.sql`vp.min_price >= ${filters.minPriceCents}`);
  }
  if (typeof filters.maxPriceCents === "number") {
    conditions.push(Prisma.sql`vp.min_price <= ${filters.maxPriceCents}`);
  }
  if (typeof filters.minRating === "number" && filters.minRating > 0) {
    conditions.push(Prisma.sql`p."ratingAverageBps" >= ${Math.round(filters.minRating * 100)}`);
  }
  if (filters.inStockOnly) conditions.push(Prisma.sql`vp.in_stock`);
  if (filters.onSaleOnly) conditions.push(Prisma.sql`vp.on_sale`);

  for (const [key, values] of Object.entries(filters.attributes ?? {})) {
    if (!values.length || options.excludeAttribute === key) continue;
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM product_attributes pa
      JOIN attribute_definitions ad ON ad.id = pa."definitionId"
      WHERE pa."productId" = p.id AND ad.key = ${key} AND pa.value = ANY(${values}::text[])
    )`);
  }

  return conditions;
}

function orderClause(sort: SortKey, hasQuery: boolean): Prisma.Sql {
  switch (sort) {
    case "price-asc":
      return Prisma.sql`vp.min_price ASC, p.title ASC`;
    case "price-desc":
      return Prisma.sql`vp.min_price DESC, p.title ASC`;
    case "newest":
      return Prisma.sql`p."publishedAt" DESC NULLS LAST, p."createdAt" DESC`;
    case "rating":
      return Prisma.sql`p."ratingAverageBps" DESC, p."ratingCount" DESC`;
    case "popular":
      return Prisma.sql`p."soldCount" DESC, p."ratingCount" DESC`;
    case "relevance":
    default:
      return hasQuery
        ? Prisma.sql`p."isFeatured" DESC, p."soldCount" DESC, p.title ASC`
        : Prisma.sql`p."isFeatured" DESC, p."publishedAt" DESC NULLS LAST`;
  }
}

export async function listProducts(input: {
  filters?: CatalogFilters;
  sort?: SortKey;
  page?: number;
  perPage?: number;
}): Promise<CatalogPage> {
  const filters = input.filters ?? {};
  const sort = input.sort ?? "relevance";
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(60, Math.max(1, input.perPage ?? 24));
  const offset = (page - 1) * perPage;

  const searchTerms = filters.query ? await getSearchEngine().expandQuery(filters.query) : [];
  const conditions = buildConditions(filters, { searchTerms });
  const where = Prisma.join(conditions, " AND ");

  const rows = await prisma.$queryRaw<Array<{ id: string; total_count: bigint }>>(Prisma.sql`
    WITH vp AS (${VARIANT_ROLLUP})
    SELECT p.id, COUNT(*) OVER() AS total_count
    FROM products p
    JOIN vp ON vp.product_id = p.id
    LEFT JOIN brands b ON b.id = p."brandId"
    WHERE ${where}
    ORDER BY ${orderClause(sort, Boolean(filters.query))}
    LIMIT ${perPage} OFFSET ${offset}
  `);

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const ids = rows.map((row) => row.id);

  if (ids.length === 0) {
    return { items: [], total: 0, page, perPage, pageCount: 0 };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: PRODUCT_CARD_SELECT,
  });

  // Preserve the SQL ordering.
  const byId = new Map(products.map((product) => [product.id, product]));
  const items = ids.map((id) => byId.get(id)).filter(Boolean).map((p) => toProductCard(p!));

  return { items, total, page, perPage, pageCount: Math.ceil(total / perPage) };
}

export async function getFacets(filters: CatalogFilters): Promise<CatalogFacets> {
  const searchTerms = filters.query ? await getSearchEngine().expandQuery(filters.query) : [];
  const base = (options: ConditionOptions = {}) =>
    Prisma.join(buildConditions(filters, { ...options, searchTerms }), " AND ");

  const [brandRows, priceRow, availabilityRow, categoryRows, attributeRows] = await Promise.all([
    prisma.$queryRaw<Array<{ slug: string; name: string; count: bigint }>>(Prisma.sql`
      WITH vp AS (${VARIANT_ROLLUP})
      SELECT b.slug, b.name, COUNT(*) AS count
      FROM products p
      JOIN vp ON vp.product_id = p.id
      JOIN brands b ON b.id = p."brandId"
      WHERE ${base({ excludeBrands: true })}
      GROUP BY b.slug, b.name
      ORDER BY count DESC, b.name ASC
    `),
    prisma.$queryRaw<Array<{ min_price: number | null; max_price: number | null }>>(Prisma.sql`
      WITH vp AS (${VARIANT_ROLLUP})
      SELECT MIN(vp.min_price)::int AS min_price, MAX(vp.max_price)::int AS max_price
      FROM products p
      JOIN vp ON vp.product_id = p.id
      LEFT JOIN brands b ON b.id = p."brandId"
      WHERE ${base()}
    `),
    prisma.$queryRaw<Array<{ in_stock: bigint; on_sale: bigint }>>(Prisma.sql`
      WITH vp AS (${VARIANT_ROLLUP})
      SELECT COUNT(*) FILTER (WHERE vp.in_stock) AS in_stock,
             COUNT(*) FILTER (WHERE vp.on_sale) AS on_sale
      FROM products p
      JOIN vp ON vp.product_id = p.id
      LEFT JOIN brands b ON b.id = p."brandId"
      WHERE ${base()}
    `),
    prisma.$queryRaw<Array<{ slug: string; name: string; count: bigint }>>(Prisma.sql`
      WITH vp AS (${VARIANT_ROLLUP})
      SELECT c.slug, c.name, COUNT(DISTINCT p.id) AS count
      FROM products p
      JOIN vp ON vp.product_id = p.id
      LEFT JOIN brands b ON b.id = p."brandId"
      JOIN product_categories pc ON pc."productId" = p.id
      JOIN categories c ON c.id = pc."categoryId"
      WHERE ${base()} AND c."parentId" IS NOT NULL
      GROUP BY c.slug, c.name
      ORDER BY count DESC, c.name ASC
      LIMIT 20
    `),
    prisma.$queryRaw<Array<{ key: string; label: string; value: string; count: bigint }>>(Prisma.sql`
      WITH vp AS (${VARIANT_ROLLUP})
      SELECT ad.key, ad.label, pa.value, COUNT(*) AS count
      FROM products p
      JOIN vp ON vp.product_id = p.id
      LEFT JOIN brands b ON b.id = p."brandId"
      JOIN product_attributes pa ON pa."productId" = p.id
      JOIN attribute_definitions ad ON ad.id = pa."definitionId" AND ad."isFilterable"
      WHERE ${base()}
      GROUP BY ad.key, ad.label, ad.position, pa.value
      ORDER BY ad.position ASC, count DESC
    `),
  ]);

  const attributes: CatalogFacets["attributes"] = [];
  for (const row of attributeRows) {
    let group = attributes.find((entry) => entry.key === row.key);
    if (!group) {
      group = { key: row.key, label: row.label, values: [] };
      attributes.push(group);
    }
    if (group.values.length < 12) {
      group.values.push({ value: row.value, label: prettyValue(row.value), count: Number(row.count) });
    }
  }

  return {
    brands: brandRows.map((row) => ({ value: row.slug, label: row.name, count: Number(row.count) })),
    categories: categoryRows.map((row) => ({ value: row.slug, label: row.name, count: Number(row.count) })),
    attributes: attributes.filter((group) => group.values.length > 1),
    priceRange: {
      minCents: priceRow[0]?.min_price ?? 0,
      maxCents: priceRow[0]?.max_price ?? 0,
    },
    availability: {
      inStock: Number(availabilityRow[0]?.in_stock ?? 0),
      onSale: Number(availabilityRow[0]?.on_sale ?? 0),
    },
  };
}

function prettyValue(value: string): string {
  if (value === "true") return "Yes";
  if (value === "false") return "No";
  return value;
}

export const getProductBySlug = cache(async (slug: string) => {
  const product = await prisma.product.findFirst({
    where: { slug, status: "ACTIVE", deletedAt: null },
    include: {
      brand: true,
      taxClass: { select: { rateBps: true, name: true } },
      categories: {
        include: { category: { select: { id: true, name: true, slug: true, parentId: true } } },
        orderBy: { isPrimary: "desc" },
      },
      media: { orderBy: { position: "asc" } },
      options: {
        orderBy: { position: "asc" },
        include: { values: { orderBy: { position: "asc" } } },
      },
      attributes: {
        include: { definition: { select: { key: true, label: true, unit: true, type: true, position: true } } },
      },
      variants: {
        where: { isActive: true, deletedAt: null },
        orderBy: [{ isDefault: "desc" }, { position: "asc" }],
        include: {
          optionValues: { include: { optionValue: { include: { option: true } } } },
          inventory: { select: { onHand: true, reserved: true } },
          media: { orderBy: { position: "asc" }, select: { url: true, alt: true } },
        },
      },
    },
  });
  return product;
});

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export const getCategoryBySlug = cache(async (slug: string) => {
  return prisma.category.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    include: {
      parent: { select: { name: true, slug: true } },
      children: {
        where: { isActive: true, deletedAt: null },
        orderBy: { position: "asc" },
        select: { id: true, name: true, slug: true, imageUrl: true, imageAlt: true },
      },
    },
  });
});

export const getCategoryTree = cache(async () => {
  const categories = await prisma.category.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      imageUrl: true,
      imageAlt: true,
      description: true,
      isFeatured: true,
    },
  });

  const roots = categories.filter((category) => category.parentId === null);
  return roots.map((root) => ({
    ...root,
    children: categories.filter((category) => category.parentId === root.id),
  }));
});

export type CategoryTree = Awaited<ReturnType<typeof getCategoryTree>>;

export const getBrandBySlug = cache(async (slug: string) =>
  prisma.brand.findFirst({ where: { slug, isActive: true, deletedAt: null } }),
);

export const listBrands = cache(async () =>
  prisma.brand.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, logoUrl: true, isFeatured: true, _count: { select: { products: true } } },
  }),
);

/** Curated rails used by the homepage and product pages. */
export async function getProductRail(
  source: "featured" | "newest" | "trending" | "sale",
  limit = 8,
): Promise<ProductCard[]> {
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    source === "newest"
      ? [{ publishedAt: "desc" }]
      : source === "trending"
        ? [{ soldCount: "desc" }, { ratingAverageBps: "desc" }]
        : source === "sale"
          ? [{ updatedAt: "desc" }]
          : [{ isFeatured: "desc" }, { soldCount: "desc" }];

  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      ...(source === "featured" ? { isFeatured: true } : {}),
      ...(source === "sale" ? { variants: { some: { salePriceCents: { not: null }, isActive: true } } } : {}),
    },
    orderBy,
    take: limit,
    select: PRODUCT_CARD_SELECT,
  });

  return products.map(toProductCard);
}

export async function getRelatedProducts(
  productId: string,
  kind: "RELATED" | "CROSS_SELL" | "UPSELL" = "RELATED",
  limit = 6,
): Promise<ProductCard[]> {
  const relations = await prisma.productRelation.findMany({
    where: { sourceId: productId, kind },
    orderBy: { position: "asc" },
    take: limit,
    select: { target: { select: PRODUCT_CARD_SELECT } },
  });
  return relations
    .map((relation) => relation.target)
    .filter((target): target is ProductRow => Boolean(target))
    .map(toProductCard);
}

export async function getProductCardsByIds(ids: readonly string[]): Promise<ProductCard[]> {
  if (ids.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: [...ids] }, status: "ACTIVE", deletedAt: null },
    select: PRODUCT_CARD_SELECT,
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  return ids.map((id) => byId.get(id)).filter(Boolean).map((product) => toProductCard(product!));
}

/**
 * Product counts per category, including every descendant — a department's
 * products live on its child categories, so a direct count always reads zero.
 */
export async function getCategoryProductCounts(slugs: readonly string[]): Promise<Map<string, number>> {
  if (slugs.length === 0) return new Map();

  const rows = await prisma.$queryRaw<Array<{ slug: string; count: bigint }>>(Prisma.sql`
    WITH RECURSIVE roots AS (
      SELECT id, slug AS root_slug FROM categories WHERE slug = ANY(${[...slugs]}::text[])
    ),
    tree AS (
      SELECT id, root_slug FROM roots
      UNION ALL
      SELECT c.id, t.root_slug FROM categories c JOIN tree t ON c."parentId" = t.id
    )
    SELECT t.root_slug AS slug, COUNT(DISTINCT p.id) AS count
    FROM tree t
    JOIN product_categories pc ON pc."categoryId" = t.id
    JOIN products p ON p.id = pc."productId" AND p.status = 'ACTIVE' AND p."deletedAt" IS NULL
    GROUP BY t.root_slug
  `);

  return new Map(rows.map((row) => [row.slug, Number(row.count)]));
}
