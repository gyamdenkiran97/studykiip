import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import type { z } from "zod";
import type { heroConfig } from "@/server/validation/homepage";

/**
 * Hero.
 *
 * An asymmetric editorial split: type on the left in a narrow measure, a tall
 * portrait image panel on the right that bleeds to the top of the viewport.
 * Deliberately not a centred headline over a full-bleed photograph — that is
 * the arrangement every store already uses.
 */
export function Hero({
  title,
  subtitle,
  config,
  departments,
}: {
  title: string | null;
  subtitle: string | null;
  config: z.infer<typeof heroConfig>;
  departments: Array<{ name: string; slug: string }>;
}) {
  return (
    <section className="border-b border-line bg-paper" aria-labelledby="hero-title">
      <div className="shell grid items-stretch gap-10 pt-10 pb-0 lg:grid-cols-[1fr_minmax(0,46%)] lg:gap-16 lg:pt-16">
        <div className="flex flex-col justify-center pb-12 lg:pb-24">
          {config.eyebrow ? (
            <Reveal variant="fade">
              <div className="mb-6 flex items-center gap-3">
                <span className="h-px w-10 bg-clay" aria-hidden="true" />
                <span className="eyebrow text-clay">{config.eyebrow}</span>
              </div>
            </Reveal>
          ) : null}

          <Reveal delay={60}>
            <h1 id="hero-title" className="text-display-1 text-balance">
              {title ?? "The considered department store"}
            </h1>
          </Reveal>

          {subtitle ? (
            <Reveal delay={140}>
              <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink-soft">{subtitle}</p>
            </Reveal>
          ) : null}

          <Reveal delay={220}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              {config.primaryCta ? (
                <Button asChild size="lg">
                  <Link href={config.primaryCta.href}>{config.primaryCta.label}</Link>
                </Button>
              ) : null}
              {config.secondaryCta ? (
                <Button asChild size="lg" variant="outline">
                  <Link href={config.secondaryCta.href}>
                    {config.secondaryCta.label}
                    <ArrowRight size={16} strokeWidth={1.8} />
                  </Link>
                </Button>
              ) : null}
            </div>
          </Reveal>
        </div>

        <Reveal variant="mask" className="relative -mb-px lg:mt-0">
          <div className="relative aspect-4/5 w-full overflow-hidden bg-paper-deep lg:aspect-auto lg:h-full lg:min-h-[32rem]">
            <ProductImage
              src={config.imageUrl}
              alt={config.imageAlt ?? ""}
              sizes="(max-width: 1024px) 100vw, 46vw"
              priority
            />
          </div>
        </Reveal>
      </div>

      {/* A mall directory rather than a hero caption: the floors, numbered. */}
      <div className="border-t border-line">
        <div className="shell no-scrollbar flex items-center gap-8 overflow-x-auto py-4">
          <span className="eyebrow shrink-0">Directory</span>
          {departments.map((department, index) => (
            <Link
              key={department.slug}
              href={`/category/${department.slug}`}
              className="group flex shrink-0 items-baseline gap-2 text-[13px] whitespace-nowrap text-ink-soft transition-colors hover:text-ink"
            >
              <span className="tabular text-[11px] text-muted-soft">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-ink">
                {department.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
