import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badge = cva(
  "inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none",
  {
    variants: {
      tone: {
        sale: "bg-clay text-paper",
        neutral: "bg-ink text-paper",
        quiet: "border border-line-strong bg-surface/80 text-ink-soft backdrop-blur-[2px]",
        low: "bg-warning/12 text-warning",
        out: "bg-ink/8 text-muted",
        success: "bg-success/12 text-success",
        danger: "bg-danger/10 text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
