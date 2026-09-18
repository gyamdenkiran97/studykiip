import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * One button, five intents. Radii stay tight (3px) and the primary action is
 * solid ink — the accent colour is reserved for prices and sale states so that
 * "on sale" never competes with "add to basket".
 */
const button = cva(
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-[background-color,color,border-color,transform] duration-200 ease-[var(--ease-out-soft)] disabled:pointer-events-none disabled:opacity-45 active:translate-y-px [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ink text-paper hover:bg-ink-soft",
        secondary: "bg-paper-deep text-ink hover:bg-line",
        outline: "border border-ink/25 bg-transparent text-ink hover:border-ink hover:bg-ink/[0.04]",
        ghost: "text-ink hover:bg-ink/[0.06]",
        link: "text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink",
        danger: "bg-danger text-paper hover:bg-danger/90",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px] rounded-xs",
        md: "h-11 px-5 text-sm rounded-xs",
        lg: "h-13 px-7 text-[15px] rounded-xs",
        icon: "h-10 w-10 rounded-xs",
        "icon-sm": "h-8 w-8 rounded-xs",
      },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", full: false },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof button> & { asChild?: boolean };

export function Button({ className, variant, size, full, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(button({ variant, size, full }), className)} {...props} />;
}

export { button as buttonVariants };
