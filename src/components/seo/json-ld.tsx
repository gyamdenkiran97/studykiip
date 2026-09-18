import { env } from "@/server/env";

/**
 * Structured data.
 *
 * Emitted as a JSON script tag. The payload is built from typed objects and
 * serialised with JSON.stringify, and `<` is escaped so no value can close the
 * script element — the standard injection route for JSON-LD.
 */

function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function OrganizationJsonLd() {
  const url = env.NEXT_PUBLIC_APP_URL;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "OnlineStore",
        name: "Kiip Mall",
        url,
        description: "A department store for things worth keeping.",
        potentialAction: {
          "@type": "SearchAction",
          target: `${url}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: Array<{ name: string; href: string }> }) {
  const url = env.NEXT_PUBLIC_APP_URL;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: `${url}${item.href}`,
        })),
      }}
    />
  );
}

export function ProductJsonLd({
  product,
}: {
  product: {
    name: string;
    description: string;
    slug: string;
    sku: string;
    brandName: string | null;
    images: string[];
    priceCents: number;
    currency: string;
    inStock: boolean;
    ratingAverage: number;
    ratingCount: number;
  };
}) {
  const url = env.NEXT_PUBLIC_APP_URL;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        sku: product.sku,
        image: product.images.map((image) => `${url}${image}`),
        ...(product.brandName ? { brand: { "@type": "Brand", name: product.brandName } } : {}),
        offers: {
          "@type": "Offer",
          url: `${url}/product/${product.slug}`,
          priceCurrency: product.currency,
          price: (product.priceCents / 100).toFixed(2),
          availability: product.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
        },
        ...(product.ratingCount > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: product.ratingAverage.toFixed(1),
                reviewCount: product.ratingCount,
              },
            }
          : {}),
      }}
    />
  );
}
