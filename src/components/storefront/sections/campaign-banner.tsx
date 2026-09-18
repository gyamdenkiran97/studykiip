import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { Reveal } from "@/components/motion/reveal";
import type { z } from "zod";
import type { bannerConfig } from "@/server/validation/homepage";

/**
 * Campaign banner. Text sits in a solid panel beside the image rather than on
 * top of it — always legible, never dependent on a scrim.
 */
export function CampaignBanner({
  title,
  subtitle,
  config,
}: {
  title: string | null;
  subtitle: string | null;
  config: z.infer<typeof bannerConfig>;
}) {
  return (
    <section className="shell py-16 lg:py-24">
      <Reveal>
        <div className="grid overflow-hidden border border-line lg:grid-cols-[1.25fr_1fr]">
          <div className="relative aspect-16/10 bg-paper-deep lg:aspect-auto lg:min-h-[24rem]">
            <ProductImage
              src={config.imageUrl}
              alt={config.imageAlt ?? ""}
              sizes="(max-width: 1024px) 100vw, 56vw"
            />
          </div>
          <div className="flex flex-col justify-center bg-forest px-8 py-12 text-paper lg:px-12">
            <span className="eyebrow text-paper/55">Campaign</span>
            <h2 className="mt-4 font-display text-[clamp(1.75rem,1.2rem+1.8vw,2.5rem)] leading-[1.05] tracking-[-0.02em] text-balance">
              {title}
            </h2>
            {subtitle ? <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-paper/75">{subtitle}</p> : null}
            {config.href ? (
              <Link
                href={config.href}
                className="group mt-8 inline-flex w-fit items-center gap-2 border-b border-paper/40 pb-1 text-[14px] font-medium transition-colors hover:border-paper"
              >
                {config.ctaLabel ?? "Shop the campaign"}
                <ArrowRight
                  size={16}
                  strokeWidth={1.8}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            ) : null}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
