"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Heart, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { discountPercent } from "@/lib/money";
import type { ProductCard as ProductCardData } from "@/server/catalog/types";
import { toggleWishlistAction } from "@/server/actions/wishlist";
import { ProductImage } from "@/components/ui/product-image";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";
import { Badge } from "@/components/ui/badge";
import { useCart } from "./cart-provider";

/**
 * Product card.
 *
 * Portrait 5:6 image, a secondary image revealed on hover, and the metadata
 * stacked below in a fixed rhythm so a grid of cards aligns on every row
 * regardless of title length. Quick-add appears on hover for pointer users and
 * is always present for keyboard users via focus-within.
 */
export function ProductCard({
  product,
  priority = false,
  isWishlisted = false,
  sizes,
  className,
}: {
  product: ProductCardData;
  priority?: boolean;
  isWishlisted?: boolean;
  sizes?: string;
  className?: string;
}) {
  const { add } = useCart();
  const [saved, setSaved] = useState(isWishlisted);
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  const onSale = product.compareAtCents !== null && product.compareAtCents > product.priceCents;
  const percent = onSale ? discountPercent(product.compareAtCents!, product.priceCents) : 0;
  const canQuickAdd = product.variantCount === 1 && product.inStock && product.defaultVariantId;

  function toggleWishlist() {
    const next = !saved;
    setSaved(next); // optimistic
    startTransition(async () => {
      const result = await toggleWishlistAction({ productId: product.id });
      if (!result.ok) {
        setSaved(!next);
        toast.error(
          result.code === "UNAUTHENTICATED" ? "Sign in to save items to your wishlist." : result.message,
        );
        return;
      }
      setSaved(result.data.saved);
    });
  }

  async function quickAdd() {
    if (!product.defaultVariantId) return;
    setAdding(true);
    await add(product.defaultVariantId, 1);
    setAdding(false);
  }

  return (
    <article className={cn("group/card relative flex flex-col", className)}>
      <div className="relative overflow-hidden bg-paper-deep">
        <Link href={`/product/${product.slug}`} className="block" tabIndex={-1} aria-hidden="true">
          <div className="relative aspect-5/6">
            <ProductImage
              src={product.primaryImage?.url}
              alt=""
              sizes={sizes ?? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw"}
              priority={priority}
              className="transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover/card:scale-[1.035] motion-reduce:transition-none motion-reduce:group-hover/card:scale-100"
            />
            {product.secondaryImage ? (
              <ProductImage
                src={product.secondaryImage.url}
                alt=""
                sizes={sizes ?? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw"}
                className="opacity-0 transition-opacity duration-500 ease-[var(--ease-out-soft)] group-hover/card:opacity-100 motion-reduce:hidden"
              />
            ) : null}
          </div>
        </Link>

        <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {onSale ? <Badge tone="sale">−{percent}%</Badge> : null}
          {!product.inStock ? <Badge tone="out">Sold out</Badge> : null}
          {product.inStock && product.isLowStock ? <Badge tone="low">Low stock</Badge> : null}
        </div>

        <button
          type="button"
          onClick={toggleWishlist}
          disabled={pending}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`}
          className={cn(
            "absolute top-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-xs text-ink transition-colors",
            "bg-surface/85 backdrop-blur-[2px] hover:bg-surface",
            "opacity-0 focus-visible:opacity-100 group-hover/card:opacity-100 sm:opacity-0",
            "max-sm:opacity-100",
            saved && "opacity-100",
          )}
        >
          <Heart
            size={17}
            strokeWidth={1.6}
            className={cn("transition-transform duration-300", saved && "scale-110 fill-clay text-clay")}
          />
        </button>

        {canQuickAdd ? (
          <div className="absolute inset-x-2.5 bottom-2.5 translate-y-2 opacity-0 transition-all duration-300 ease-[var(--ease-out-soft)] group-hover/card:translate-y-0 group-hover/card:opacity-100 group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100 max-sm:hidden motion-reduce:translate-y-0">
            <button
              type="button"
              onClick={quickAdd}
              disabled={adding}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xs bg-ink text-[13px] font-medium text-paper transition-colors hover:bg-ink-soft disabled:opacity-60"
            >
              <Plus size={15} strokeWidth={2} />
              {adding ? "Adding…" : "Quick add"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col pt-3.5">
        {product.brand ? (
          <span className="text-[11px] tracking-[0.1em] text-muted uppercase">{product.brand.name}</span>
        ) : null}
        <h3 className="mt-1 font-sans text-[15px] leading-snug font-medium text-ink">
          <Link href={`/product/${product.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {product.title}
          </Link>
        </h3>
        {product.ratingCount > 0 ? (
          <Rating value={product.ratingAverage} count={product.ratingCount} className="mt-1.5" />
        ) : null}
        <div className="mt-auto flex items-baseline gap-2 pt-2.5">
          <Price cents={product.priceCents} compareAtCents={product.compareAtCents} currency={product.currency} />
          {product.variantCount > 1 ? (
            <span className="text-[11px] text-muted">{product.variantCount} options</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
