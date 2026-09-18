import type { ProductCard as ProductCardData } from "@/server/catalog/types";
import { ProductCard } from "../product-card";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "./section-heading";
import { cn } from "@/lib/cn";

/**
 * Horizontal product rail. Scroll-snapped on touch, a plain grid from the large
 * breakpoint up — no carousel chrome, no autoplay, nothing that moves on its own.
 */
export function ProductRail({
  title,
  subtitle,
  eyebrow,
  products,
  href,
  wishlisted,
  className,
}: {
  title: string;
  subtitle?: string | null;
  eyebrow?: string;
  products: ProductCardData[];
  href?: string;
  wishlisted?: Set<string>;
  className?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className={cn("py-16 lg:py-24", className)} aria-label={title}>
      <div className="shell">
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} href={href} className="mb-10" />
      </div>

      <div className="shell no-scrollbar -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-3 md:gap-x-6 md:gap-y-12 md:overflow-visible md:px-10 lg:grid-cols-4 xl:px-16">
        {products.map((product, index) => (
          <Reveal
            key={product.id}
            delay={Math.min(index * 60, 300)}
            className="w-[63vw] shrink-0 snap-start sm:w-[42vw] md:w-auto"
          >
            <ProductCard
              product={product}
              isWishlisted={wishlisted?.has(product.id) ?? false}
              sizes="(max-width: 768px) 63vw, (max-width: 1024px) 33vw, 23vw"
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
