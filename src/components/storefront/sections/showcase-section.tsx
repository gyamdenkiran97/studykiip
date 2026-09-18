import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Showcase3D } from "@/components/three/showcase";
import { Reveal } from "@/components/motion/reveal";
import { Price } from "@/components/ui/price";
import type { ProductCard } from "@/server/catalog/types";

/**
 * Interactive showcase. The 3D canvas is decorative and progressive: the price,
 * the description and the link to buy are all plain HTML beside it.
 */
export function ShowcaseSection({
  title,
  subtitle,
  product,
}: {
  title: string | null;
  subtitle: string | null;
  product: ProductCard | null;
}) {
  return (
    <section className="border-y border-line bg-paper-deep py-16 lg:py-24" aria-labelledby="showcase-title">
      <div className="shell grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal variant="fade">
          <Showcase3D
            fallbackImageUrl={product?.primaryImage?.url ?? null}
            fallbackImageAlt={product?.primaryImage?.alt ?? ""}
          />
        </Reveal>

        <Reveal delay={100}>
          <span className="eyebrow text-clay">In three dimensions</span>
          <h2 id="showcase-title" className="mt-4 text-display-3 text-balance">
            {title ?? "Turn it over"}
          </h2>
          {subtitle ? <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-soft">{subtitle}</p> : null}

          {product ? (
            <div className="mt-8 border-t border-line-strong pt-6">
              {product.brand ? (
                <p className="text-[11px] tracking-[0.1em] text-muted uppercase">{product.brand.name}</p>
              ) : null}
              <p className="mt-1.5 font-display text-xl">{product.title}</p>
              <div className="mt-2">
                <Price
                  cents={product.priceCents}
                  compareAtCents={product.compareAtCents}
                  currency={product.currency}
                  size="lg"
                />
              </div>
              <Link
                href={`/product/${product.slug}`}
                className="group mt-6 inline-flex items-center gap-2 text-[14px] font-medium"
              >
                <span className="border-b border-ink pb-1">View the product</span>
                <ArrowRight
                  size={16}
                  strokeWidth={1.8}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            </div>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}
