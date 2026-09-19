import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getProductBySlug, getRelatedProducts } from "@/server/catalog/queries";
import { getWishlistProductIds } from "@/server/wishlist";
import { getRecentlyViewed, recordProductView } from "@/server/activity/recently-viewed";
import { effectivePrice } from "@/server/pricing";
import { prisma } from "@/server/db";
import { trackServerEvent } from "@/server/analytics";
import { BuyBox } from "@/components/storefront/product/buy-box";
import { ProductReviews } from "@/components/storefront/product/reviews";
import { ProductRail } from "@/components/storefront/sections/product-rail";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/components/seo/json-ld";
import { ProductDetails } from "@/components/storefront/product/details";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };

  const image = product.media.find((media) => media.kind === "IMAGE")?.url;

  return {
    title: product.metaTitle ?? product.title,
    description: product.metaDescription ?? product.shortDescription ?? undefined,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.metaTitle ?? product.title,
      description: product.metaDescription ?? product.shortDescription ?? undefined,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [wishlisted, related, crossSells, recentlyViewed, settings] = await Promise.all([
    getWishlistProductIds(),
    getRelatedProducts(product.id, "RELATED", 4),
    getRelatedProducts(product.id, "CROSS_SELL", 4),
    getRecentlyViewed({ excludeProductId: product.id, limit: 6 }),
    prisma.siteSetting.findUnique({ where: { key: "commerce" } }),
  ]);

  // Fire-and-forget: recording a view must never delay or break the page.
  void recordProductView(product.id);
  void trackServerEvent("view_item", { productId: product.id, slug: product.slug });

  const commerce = (settings?.value ?? {}) as { returnWindowDays?: number; freeShippingThresholdCents?: number };

  const variants = product.variants.map((variant) => {
    const price = effectivePrice(variant);
    const available = variant.inventory.reduce((total, item) => total + item.onHand - item.reserved, 0);
    return {
      id: variant.id,
      sku: variant.sku,
      title: variant.title,
      priceCents: price.unitPriceCents,
      compareAtCents: price.compareAtCents,
      currency: variant.currency,
      available,
      allowBackorder: variant.allowBackorder,
      isLowStock: available > 0 && available <= variant.lowStockThreshold,
      optionValueIds: variant.optionValues.map((entry) => entry.optionValue.id),
      imageUrls: variant.media.map((media) => media.url),
    };
  });

  // An image attached to a variant represents that variant's option values
  // (a colourway), so it is shown for every variant sharing them — not only the
  // single SKU the row happens to point at.
  const images = [
    ...product.variants.flatMap((variant) =>
      variant.media.map((media) => ({
        url: media.url,
        alt: media.alt,
        variantId: variant.id,
        optionValueIds: variant.optionValues.map((entry) => entry.optionValue.id),
      })),
    ),
    ...product.media
      .filter((media) => media.kind === "IMAGE" && media.variantId === null)
      .map((media) => ({ url: media.url, alt: media.alt, variantId: null, optionValueIds: [] })),
  ];

  const primaryCategory = product.categories[0]?.category ?? null;
  const parentCategory = primaryCategory?.parentId
    ? await prisma.category.findUnique({
        where: { id: primaryCategory.parentId },
        select: { name: true, slug: true },
      })
    : null;

  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: "Shop", href: "/shop" },
    ...(parentCategory ? [{ name: parentCategory.name, href: `/category/${parentCategory.slug}` }] : []),
    ...(primaryCategory ? [{ name: primaryCategory.name, href: `/category/${primaryCategory.slug}` }] : []),
    { name: product.title, href: `/product/${product.slug}` },
  ];

  const cheapest = variants.reduce(
    (best, variant) => (variant.priceCents < best.priceCents ? variant : best),
    variants[0],
  );
  const anyInStock = variants.some((variant) => variant.available > 0 || variant.allowBackorder);
  const returnDays = commerce.returnWindowDays ?? 30;

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbs} />
      <ProductJsonLd
        product={{
          name: product.title,
          description: product.shortDescription ?? product.description.slice(0, 300),
          slug: product.slug,
          sku: cheapest?.sku ?? "",
          brandName: product.brand?.name ?? null,
          images: images.slice(0, 4).map((image) => image.url),
          priceCents: cheapest?.priceCents ?? 0,
          currency: cheapest?.currency ?? "GBP",
          inStock: anyInStock,
          ratingAverage: product.ratingAverageBps / 100,
          ratingCount: product.ratingCount,
        }}
      />

      <div className="shell pt-6 pb-16">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.href} className="flex items-center gap-1.5">
                {index > 0 ? <ChevronRight size={13} strokeWidth={1.6} aria-hidden="true" /> : null}
                {index === breadcrumbs.length - 1 ? (
                  <span aria-current="page" className="max-w-[16rem] truncate text-ink-soft">
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

        <BuyBox
          productId={product.id}
          productTitle={product.title}
          slug={product.slug}
          brand={product.brand ? { name: product.brand.name, slug: product.brand.slug } : null}
          options={product.options.map((option) => ({
            id: option.id,
            name: option.name,
            values: option.values.map((value) => ({
              id: value.id,
              value: value.value,
              swatchHex: value.swatchHex,
            })),
          }))}
          variants={variants}
          images={images}
          rating={product.ratingAverageBps / 100}
          ratingCount={product.ratingCount}
          initiallyWishlisted={wishlisted.has(product.id)}
          deliveryNote={`Free UK delivery over ${((commerce.freeShippingThresholdCents ?? 5000) / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" })}. Standard 3–5 working days.`}
          returnsNote={`${returnDays}-day returns, unused and in original packaging.`}
        />

        <ProductDetails
          description={product.description}
          shortDescription={product.shortDescription}
          attributes={product.attributes
            .map((attribute) => ({
              key: attribute.definition.key,
              label: attribute.definition.label,
              unit: attribute.definition.unit,
              type: attribute.definition.type,
              position: attribute.definition.position,
              value: attribute.value,
            }))
            .sort((a, b) => a.position - b.position)}
          variants={product.variants.map((variant) => ({
            sku: variant.sku,
            title: variant.title,
            weightGrams: variant.weightGrams,
            lengthMm: variant.lengthMm,
            widthMm: variant.widthMm,
            heightMm: variant.heightMm,
          }))}
          returnDays={returnDays}
        />

        <ProductReviews
          productId={product.id}
          productSlug={product.slug}
          ratingAverage={product.ratingAverageBps / 100}
        />
      </div>

      {related.length > 0 ? (
        <ProductRail
          title="You might also like"
          products={related}
          wishlisted={wishlisted}
          className="border-t border-line bg-paper-deep"
        />
      ) : null}

      {crossSells.length > 0 ? (
        <ProductRail title="Goes well with" products={crossSells} wishlisted={wishlisted} />
      ) : null}

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
