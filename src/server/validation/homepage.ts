import { z } from "zod";

/**
 * Homepage sections are admin-editable rows whose `config` is JSON. Every shape
 * is parsed here before it reaches a component, so a malformed or malicious
 * config renders nothing rather than breaking the page.
 */

const cta = z.object({ label: z.string().max(60), href: z.string().max(400) });

export const heroConfig = z.object({
  eyebrow: z.string().max(60).optional(),
  imageUrl: z.string().max(400).optional(),
  imageAlt: z.string().max(200).optional(),
  primaryCta: cta.optional(),
  secondaryCta: cta.optional(),
});

export const categoryGridConfig = z.object({
  categorySlugs: z.array(z.string().max(80)).max(12).default([]),
});

export const productCarouselConfig = z.object({
  source: z.enum(["featured", "newest", "trending", "sale"]).default("featured"),
  limit: z.number().int().min(2).max(16).default(8),
  href: z.string().max(400).optional(),
});

export const editorialConfig = z.object({
  imageUrl: z.string().max(400).optional(),
  imageAlt: z.string().max(200).optional(),
  href: z.string().max(400).optional(),
  ctaLabel: z.string().max(60).optional(),
  align: z.enum(["left", "right"]).default("left"),
});

export const bannerConfig = editorialConfig;

export const showcase3dConfig = z.object({
  productSlug: z.string().max(120),
});

export const benefitsConfig = z.object({
  items: z
    .array(z.object({ title: z.string().max(80), body: z.string().max(200) }))
    .max(6)
    .default([]),
});

export const HOMEPAGE_SECTION_SCHEMAS = {
  HERO: heroConfig,
  CATEGORY_GRID: categoryGridConfig,
  PRODUCT_CAROUSEL: productCarouselConfig,
  EDITORIAL: editorialConfig,
  BANNER: bannerConfig,
  SHOWCASE_3D: showcase3dConfig,
  BENEFITS: benefitsConfig,
  NEWSLETTER: z.object({}).passthrough(),
} as const;

export type HomepageSectionKind = keyof typeof HOMEPAGE_SECTION_SCHEMAS;

/** Returns the parsed config, or null when the row cannot be trusted. */
export function parseSectionConfig<K extends HomepageSectionKind>(
  kind: K,
  config: unknown,
): z.infer<(typeof HOMEPAGE_SECTION_SCHEMAS)[K]> | null {
  const schema = HOMEPAGE_SECTION_SCHEMAS[kind];
  const result = schema.safeParse(config ?? {});
  return result.success ? (result.data as z.infer<(typeof HOMEPAGE_SECTION_SCHEMAS)[K]>) : null;
}
