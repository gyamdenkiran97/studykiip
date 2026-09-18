import { discountPercent, formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * Prices are the one place the accent colour earns its keep. A markdown shows
 * the old price struck through and announces the saving to screen readers.
 */
export function Price({
  cents,
  compareAtCents,
  currency = "GBP",
  size = "md",
  className,
}: {
  cents: number;
  compareAtCents?: number | null;
  currency?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const onSale = typeof compareAtCents === "number" && compareAtCents > cents;
  const sizes = {
    sm: "text-[13px]",
    md: "text-[15px]",
    lg: "text-xl",
  } as const;

  return (
    <span className={cn("tabular inline-flex items-baseline gap-2", sizes[size], className)}>
      <span className={cn("font-medium", onSale && "text-clay")}>{formatMoney(cents, currency)}</span>
      {onSale ? (
        <>
          <span className="text-muted line-through decoration-muted/60" aria-hidden="true">
            {formatMoney(compareAtCents!, currency)}
          </span>
          <span className="sr-only">
            reduced from {formatMoney(compareAtCents!, currency)}, saving{" "}
            {discountPercent(compareAtCents!, cents)} percent
          </span>
        </>
      ) : null}
    </span>
  );
}
