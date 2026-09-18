import { cn } from "@/lib/cn";

/**
 * A five-point rating drawn as a clipped bar rather than five glyphs: it renders
 * fractional ratings honestly and reads as a single value to assistive tech.
 */
export function Rating({
  value,
  count,
  size = "sm",
  showCount = true,
  className,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
  showCount?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const percent = (clamped / 5) * 100;
  const star =
    "M10 1.6l2.47 5.2 5.53.74-4.05 3.85 1.03 5.6L10 14.3 5.02 17l1.03-5.6L2 7.54l5.53-.74z";
  const dimension = size === "sm" ? 13 : 17;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className="relative inline-flex"
        role="img"
        aria-label={`Rated ${clamped.toFixed(1)} out of 5${count ? ` from ${count} reviews` : ""}`}
      >
        <span className="flex gap-0.5">
          {[0, 1, 2, 3, 4].map((index) => (
            <svg key={index} width={dimension} height={dimension} viewBox="0 0 20 20" aria-hidden="true">
              <path d={star} fill="none" stroke="currentColor" strokeWidth="1.2" className="text-line-strong" />
            </svg>
          ))}
        </span>
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${percent}%` }} aria-hidden="true">
          <span className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map((index) => (
              <svg key={index} width={dimension} height={dimension} viewBox="0 0 20 20">
                <path d={star} fill="currentColor" className="text-gold" />
              </svg>
            ))}
          </span>
        </span>
      </span>
      {showCount && typeof count === "number" ? (
        <span className="text-[12px] text-muted tabular">({count})</span>
      ) : null}
    </span>
  );
}
