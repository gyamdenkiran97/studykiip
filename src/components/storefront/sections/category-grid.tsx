import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "./section-heading";

type CategoryTile = {
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  productCount: number;
};

/**
 * Departments as an editorial mosaic.
 *
 * Tile widths follow a repeating 4/2 · 2/4 · 3/3 rhythm across a six-column
 * grid, so every row fills exactly and the composition stays ragged rather than
 * gridded. Text sits below the image, never over it, so legibility never
 * depends on a scrim.
 */

/** Column spans that always sum to six per row. */
const SPAN_RHYTHM = [4, 2, 2, 4, 3, 3];

const SPAN_CLASS: Record<number, string> = {
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
};
export function CategoryGrid({
  title,
  subtitle,
  categories,
}: {
  title: string | null;
  subtitle: string | null;
  categories: CategoryTile[];
}) {
  if (categories.length === 0) return null;

  return (
    <section className="shell py-16 lg:py-24" aria-labelledby="departments-title">
      <SectionHeading
        eyebrow="Departments"
        title={title ?? "Find your floor"}
        subtitle={subtitle}
        href="/shop"
        hrefLabel="All departments"
        className="mb-10"
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-6">
        {categories.map((category, index) => {
          const span = SPAN_RHYTHM[index % SPAN_RHYTHM.length];
          const wide = span >= 4;
          return (
            <Reveal
              key={category.slug}
              delay={Math.min(index * 70, 350)}
              className={`${wide && index === 0 ? "col-span-2" : ""} ${SPAN_CLASS[span]}`}
            >
              <Link href={`/category/${category.slug}`} className="group block">
                <div
                  className={`relative overflow-hidden bg-paper-deep ${wide ? "aspect-4/3 lg:aspect-16/9" : "aspect-4/3 lg:aspect-3/2"}`}
                >
                  <ProductImage
                    src={category.imageUrl}
                    alt={category.imageAlt ?? ""}
                    sizes={wide ? "(max-width: 1024px) 100vw, 62vw" : "(max-width: 1024px) 50vw, 33vw"}
                    className="transition-transform duration-[900ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                </div>
                <div className="mt-3.5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg leading-tight">{category.name}</h3>
                    {category.description ? (
                      <p className="mt-1 line-clamp-2 max-w-sm text-[13px] text-muted">{category.description}</p>
                    ) : null}
                  </div>
                  <span className="mt-1 flex items-center gap-2 text-[12px] whitespace-nowrap text-muted">
                    <span className="tabular">{category.productCount}</span>
                    <ArrowUpRight
                      size={15}
                      strokeWidth={1.6}
                      className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </span>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
