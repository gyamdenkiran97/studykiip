import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/cn";
import type { z } from "zod";
import type { editorialConfig } from "@/server/validation/homepage";

/** Long-form editorial block: an image column against a narrow text measure. */
export function Editorial({
  title,
  subtitle,
  config,
}: {
  title: string | null;
  subtitle: string | null;
  config: z.infer<typeof editorialConfig>;
}) {
  const imageFirst = config.align !== "right";

  return (
    <section className="border-y border-line bg-paper-deep py-16 lg:py-24">
      <div className="shell grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <Reveal variant="mask" className={cn(imageFirst ? "lg:order-1" : "lg:order-2")}>
          <div className="relative aspect-4/3 overflow-hidden bg-paper">
            <ProductImage
              src={config.imageUrl}
              alt={config.imageAlt ?? ""}
              sizes="(max-width: 1024px) 100vw, 48vw"
            />
          </div>
        </Reveal>

        <div className={cn(imageFirst ? "lg:order-2" : "lg:order-1")}>
          <Reveal>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-8 bg-clay" aria-hidden="true" />
              <span className="eyebrow text-clay">The workshop</span>
            </div>
            <h2 className="text-display-3 text-balance">{title}</h2>
            {subtitle ? (
              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-soft">{subtitle}</p>
            ) : null}
            {config.href ? (
              <Link
                href={config.href}
                className="group mt-8 inline-flex items-center gap-2 text-[14px] font-medium"
              >
                <span className="border-b border-ink pb-1">{config.ctaLabel ?? "Read more"}</span>
                <ArrowRight
                  size={16}
                  strokeWidth={1.8}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            ) : null}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
