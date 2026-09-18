import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";
import { logger } from "../logger";

/**
 * Search.
 *
 * Backed by PostgreSQL: ILIKE for substring matches and pg_trgm `similarity`
 * for typo tolerance, with an admin-editable synonym table on top. The whole
 * surface sits behind `SearchEngine`, so swapping in Meilisearch, Typesense or
 * Algolia later means writing one adapter — no page or component changes.
 */

export type Suggestion = {
  type: "product" | "category" | "brand" | "query";
  label: string;
  sublabel?: string;
  href: string;
  imageUrl?: string | null;
};

export interface SearchEngine {
  readonly name: string;
  /** Expand a raw query into the terms that should be matched. */
  expandQuery(query: string): Promise<string[]>;
  /** Typeahead suggestions across products, categories and brands. */
  suggest(query: string, limit?: number): Promise<Suggestion[]>;
}

// Control characters, plus the wildcards that would otherwise let a visitor
// craft an ILIKE pattern of their own.
const CONTROL_CHARACTERS = /[\p{Cc}]/gu;
const PATTERN_WILDCARDS = /[%_\\]/g;

/**
 * Strip characters that would confuse ILIKE/trigram matching or bloat the
 * query. Control characters become spaces rather than being deleted, so a
 * pasted multi-line string searches for its words instead of one run-on token.
 */
export function normaliseQuery(raw: string): string {
  return raw
    .replace(CONTROL_CHARACTERS, " ")
    .replace(PATTERN_WILDCARDS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

class PostgresSearchEngine implements SearchEngine {
  readonly name = "postgres";

  async expandQuery(query: string): Promise<string[]> {
    const term = normaliseQuery(query).toLowerCase();
    if (!term) return [];

    const words = term.split(" ").filter(Boolean);
    const synonymRows = await prisma.searchSynonym.findMany({
      where: {
        OR: [{ term: { in: [term, ...words] } }, { synonyms: { hasSome: [term, ...words] } }],
      },
      select: { term: true, synonyms: true },
    });

    const expanded = new Set<string>([term, ...words]);
    for (const row of synonymRows) {
      expanded.add(row.term);
      for (const synonym of row.synonyms) expanded.add(synonym);
    }

    // Singular/plural is the most common near-miss; handle it cheaply.
    for (const word of [...expanded]) {
      if (word.length > 3) {
        if (word.endsWith("s")) expanded.add(word.slice(0, -1));
        else expanded.add(`${word}s`);
      }
    }

    return [...expanded].filter((value) => value.length >= 2).slice(0, 24);
  }

  async suggest(query: string, limit = 8): Promise<Suggestion[]> {
    const term = normaliseQuery(query);
    if (term.length < 2) return [];
    const pattern = `%${term}%`;

    const [products, categories, brands] = await Promise.all([
      prisma.$queryRaw<Array<{ slug: string; title: string; brand: string | null; url: string | null }>>(Prisma.sql`
        SELECT p.slug, p.title, b.name AS brand,
               (SELECT m.url FROM product_media m
                 WHERE m."productId" = p.id AND m."variantId" IS NULL
                 ORDER BY m.position ASC LIMIT 1) AS url
        FROM products p
        LEFT JOIN brands b ON b.id = p."brandId"
        WHERE p.status = 'ACTIVE' AND p."deletedAt" IS NULL
          AND (p.title ILIKE ${pattern} OR b.name ILIKE ${pattern}
               OR EXISTS (SELECT 1 FROM unnest(p.tags) tag WHERE tag ILIKE ${pattern})
               OR similarity(p.title, ${term}) > 0.22)
        ORDER BY similarity(p.title, ${term}) DESC, p."soldCount" DESC
        LIMIT ${limit}
      `),
      prisma.category.findMany({
        where: { isActive: true, deletedAt: null, name: { contains: term, mode: "insensitive" } },
        select: { name: true, slug: true, parent: { select: { name: true } } },
        take: 3,
      }),
      prisma.brand.findMany({
        where: { isActive: true, deletedAt: null, name: { contains: term, mode: "insensitive" } },
        select: { name: true, slug: true },
        take: 3,
      }),
    ]);

    return [
      ...categories.map<Suggestion>((category) => ({
        type: "category",
        label: category.name,
        sublabel: category.parent ? `in ${category.parent.name}` : "Department",
        href: `/category/${category.slug}`,
      })),
      ...brands.map<Suggestion>((brand) => ({
        type: "brand",
        label: brand.name,
        sublabel: "Brand",
        href: `/brand/${brand.slug}`,
      })),
      ...products.map<Suggestion>((product) => ({
        type: "product",
        label: product.title,
        sublabel: product.brand ?? undefined,
        href: `/product/${product.slug}`,
        imageUrl: product.url,
      })),
    ].slice(0, limit + 4);
  }
}

let engine: SearchEngine = new PostgresSearchEngine();

export function getSearchEngine(): SearchEngine {
  return engine;
}

/** Swap the engine — used by tests and by a future dedicated search service. */
export function setSearchEngine(next: SearchEngine): void {
  engine = next;
}

/** Fire-and-forget analytics on what people actually look for. */
export async function recordSearch(query: string, results: number, userId?: string | null): Promise<void> {
  const term = normaliseQuery(query);
  if (term.length < 2) return;
  try {
    await prisma.searchQueryLog.create({
      data: { query: term.toLowerCase(), results, userId: userId ?? null },
    });
  } catch (error) {
    logger.warn("search.log_failed", { error });
  }
}

export async function popularSearches(limit = 6): Promise<string[]> {
  const rows = await prisma.searchQueryLog.groupBy({
    by: ["query"],
    _count: { query: true },
    where: { results: { gt: 0 } },
    orderBy: { _count: { query: "desc" } },
    take: limit,
  });
  return rows.map((row) => row.query);
}
