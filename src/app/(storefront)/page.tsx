import type { Metadata } from "next";
import { prisma } from "@/server/db";
import {
  getCategoryProductCounts,
  getCategoryTree,
  getProductCardsByIds,
  getProductRail,
} from "@/server/catalog/queries";
import { getWishlistProductIds } from "@/server/wishlist";
import { getRecentlyViewed } from "@/server/activity/recently-viewed";
import { parseSectionConfig } from "@/server/validation/homepage";
import { Hero } from "@/components/storefront/sections/hero";
import { CategoryGrid } from "@/components/storefront/sections/category-grid";
import { ProductRail } from "@/components/storefront/sections/product-rail";
import { Editorial } from "@/components/storefront/sections/editorial";
import { CampaignBanner } from "@/components/storefront/sections/campaign-banner";
import { Benefits } from "@/components/storefront/sections/benefits";
import { NewsletterSection } from "@/components/storefront/sections/newsletter-section";
import { ShowcaseSection } from "@/components/storefront/sections/showcase-section";
import { OrganizationJsonLd } from "@/components/seo/json-ld";

/**
 * Homepage.
 *
 * The composition is data, not code: administrators reorder, enable and
 * configure sections in the admin panel and this page renders whatever the
 * `homepage_sections` table describes, validating each config with Zod first.
 */

export const metadata: Metadata = {
  title: "Kiip Mall — a department store for things worth keeping",
  description:
    "Eleven departments under one roof: fashion, electronics, beauty, home and living, furniture, sport, accessories, food, toys, office and automotive.",
  alternates: { canonical: "/" },
};

// The homepage is public and identical for everyone; revalidate rather than
// rebuilding it per request.
export const revalidate = 300;

export default async function HomePage() {
  const [sections, tree, wishlisted] = await Promise.all([
    prisma.homepageSection.findMany({ where: { isActive: true }, orderBy: { position: "asc" } }),
    getCategoryTree(),
    getWishlistProductIds(),
  ]);

  const departments = tree.map((department) => ({ name: department.name, slug: department.slug }));
  const recentlyViewed = await getRecentlyViewed({ limit: 6 });

  const rendered = await Promise.all(
    sections.map(async (section) => {
      switch (section.kind) {
        case "HERO": {
          const config = parseSectionConfig("HERO", section.config);
          if (!config) return null;
          return (
            <Hero
              key={section.id}
              title={section.title}
              subtitle={section.subtitle}
              config={config}
              departments={departments}
            />
          );
        }

        case "CATEGORY_GRID": {
          const config = parseSectionConfig("CATEGORY_GRID", section.config);
          if (!config) return null;
          const [categories, counts] = await Promise.all([
            prisma.category.findMany({
              where: { slug: { in: config.categorySlugs }, isActive: true, deletedAt: null },
              select: { name: true, slug: true, description: true, imageUrl: true, imageAlt: true },
            }),
            getCategoryProductCounts(config.categorySlugs),
          ]);
          const ordered = config.categorySlugs
            .map((slug) => categories.find((category) => category.slug === slug))
            .filter(Boolean)
            .map((category) => ({
              name: category!.name,
              slug: category!.slug,
              description: category!.description,
              imageUrl: category!.imageUrl,
              imageAlt: category!.imageAlt,
              productCount: counts.get(category!.slug) ?? 0,
            }));
          return (
            <CategoryGrid key={section.id} title={section.title} subtitle={section.subtitle} categories={ordered} />
          );
        }

        case "PRODUCT_CAROUSEL": {
          const config = parseSectionConfig("PRODUCT_CAROUSEL", section.config);
          if (!config) return null;
          const products = await getProductRail(config.source, config.limit);
          return (
            <ProductRail
              key={section.id}
              title={section.title ?? "Selected for you"}
              subtitle={section.subtitle}
              products={products}
              wishlisted={wishlisted}
              href={config.href ?? (config.source === "sale" ? "/shop?sale=1" : "/shop?sort=newest")}
            />
          );
        }

        case "EDITORIAL": {
          const config = parseSectionConfig("EDITORIAL", section.config);
          if (!config) return null;
          return <Editorial key={section.id} title={section.title} subtitle={section.subtitle} config={config} />;
        }

        case "BANNER": {
          const config = parseSectionConfig("BANNER", section.config);
          if (!config) return null;
          return (
            <CampaignBanner key={section.id} title={section.title} subtitle={section.subtitle} config={config} />
          );
        }

        case "SHOWCASE_3D": {
          const config = parseSectionConfig("SHOWCASE_3D", section.config);
          if (!config) return null;
          const product = await prisma.product.findFirst({
            where: { slug: config.productSlug, status: "ACTIVE" },
            select: { id: true },
          });
          const [card] = product ? await getProductCardsByIds([product.id]) : [];
          return (
            <ShowcaseSection key={section.id} title={section.title} subtitle={section.subtitle} product={card ?? null} />
          );
        }

        case "BENEFITS": {
          const config = parseSectionConfig("BENEFITS", section.config);
          if (!config) return null;
          return <Benefits key={section.id} title={section.title} items={config.items} />;
        }

        case "NEWSLETTER":
          return <NewsletterSection key={section.id} title={section.title} subtitle={section.subtitle} />;

        default:
          return null;
      }
    }),
  );

  return (
    <>
      <OrganizationJsonLd />
      {rendered}
      {recentlyViewed.length > 0 ? (
        <ProductRail
          title="Recently viewed"
          products={recentlyViewed}
          wishlisted={wishlisted}
          className="border-t border-line"
        />
      ) : null}
    </>
  );
}
