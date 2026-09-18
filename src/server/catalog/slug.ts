import "server-only";
import { prisma } from "../db";

/**
 * Slugs.
 *
 * Deterministic, ASCII, and collision-safe: a clash appends -2, -3 and so on
 * rather than failing the save. Used for products, categories and brands.
 */

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    // Strip accents so "Café" becomes "cafe" rather than "caf".
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

type SlugScope = "product" | "category" | "brand";

async function slugExists(slug: string, scope: SlugScope, excludeId?: string): Promise<boolean> {
  const where = { slug, ...(excludeId ? { id: { not: excludeId } } : {}) };
  switch (scope) {
    case "category":
      return (await prisma.category.count({ where })) > 0;
    case "brand":
      return (await prisma.brand.count({ where })) > 0;
    default:
      return (await prisma.product.count({ where })) > 0;
  }
}

export async function uniqueSlug(
  desired: string,
  excludeProductId?: string,
  scope: SlugScope = "product",
  excludeId?: string,
): Promise<string> {
  const base = slugify(desired) || "item";
  const exclude = excludeId ?? excludeProductId;

  let candidate = base;
  let suffix = 2;
  while (await slugExists(candidate, scope, exclude)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 200) return `${base}-${Date.now().toString(36)}`;
  }
  return candidate;
}
