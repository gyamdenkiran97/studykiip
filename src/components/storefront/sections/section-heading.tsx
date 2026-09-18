import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Consistent section opener: eyebrow rule, display title, optional link. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  href,
  hrefLabel = "See all",
  className,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  href?: string;
  hrefLabel?: string;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-8 gap-y-3",
        align === "center" && "flex-col items-center text-center",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "flex flex-col items-center")}>
        {eyebrow ? (
          <div className="mb-3 flex items-center gap-3">
            <span className="h-px w-8 bg-line-strong" aria-hidden="true" />
            <span className="eyebrow">{eyebrow}</span>
          </div>
        ) : null}
        <h2 className="text-display-3 text-balance">{title}</h2>
        {subtitle ? <p className="mt-3 text-[15px] leading-relaxed text-muted">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 pb-1 text-[13px] font-medium text-ink"
        >
          <span className="border-b border-line-strong pb-0.5 transition-colors group-hover:border-ink">
            {hrefLabel}
          </span>
          <ArrowRight
            size={15}
            strokeWidth={1.8}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </Link>
      ) : null}
    </div>
  );
}
