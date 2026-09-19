"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ShieldCheck, Truck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { QuantityStepper } from "../cart-drawer";
import { useCart } from "../cart-provider";
import { toggleWishlistAction } from "@/server/actions/wishlist";
import { ProductGallery } from "./gallery";
import type { GalleryImage, OptionView, VariantView } from "./types";

/**
 * Buy box.
 *
 * Holds the variant matrix so that choosing an option updates price, SKU,
 * availability and imagery together. Combinations that do not exist are
 * disabled rather than hidden, so the shape of the range stays visible.
 *
 * The add-to-basket call goes to the server, which re-checks stock and price —
 * nothing here is trusted.
 */
export function BuyBox({
  productId,
  productTitle,
  brand,
  options,
  variants,
  images,
  rating,
  ratingCount,
  initiallyWishlisted,
  deliveryNote,
  returnsNote,
}: {
  productId: string;
  productTitle: string;
  brand: { name: string; slug: string } | null;
  slug: string;
  options: OptionView[];
  variants: VariantView[];
  images: GalleryImage[];
  rating: number;
  ratingCount: number;
  initiallyWishlisted: boolean;
  deliveryNote: string;
  returnsNote: string;
}) {
  const router = useRouter();
  const { add } = useCart();

  const defaultVariant = useMemo(
    () => variants.find((variant) => variant.available > 0) ?? variants[0],
    [variants],
  );

  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (!defaultVariant) return initial;
    for (const option of options) {
      const match = option.values.find((value) => defaultVariant.optionValueIds.includes(value.id));
      if (match) initial[option.id] = match.id;
    }
    return initial;
  });

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const [saved, setSaved] = useState(initiallyWishlisted);
  const [savePending, startSave] = useTransition();

  const selectedIds = Object.values(selection);
  const activeVariant = useMemo(
    () =>
      variants.find(
        (variant) =>
          selectedIds.length === options.length &&
          selectedIds.every((id) => variant.optionValueIds.includes(id)),
      ) ?? (options.length === 0 ? variants[0] : undefined),
    [options.length, selectedIds, variants],
  );

  /** A value is reachable if some variant exists combining it with the other picks. */
  function isAvailable(optionId: string, valueId: string): boolean {
    const others = Object.entries(selection).filter(([key]) => key !== optionId);
    return variants.some(
      (variant) =>
        variant.optionValueIds.includes(valueId) &&
        others.every(([, otherValue]) => variant.optionValueIds.includes(otherValue)),
    );
  }

  function inStock(optionId: string, valueId: string): boolean {
    const others = Object.entries(selection).filter(([key]) => key !== optionId);
    return variants.some(
      (variant) =>
        variant.optionValueIds.includes(valueId) &&
        others.every(([, otherValue]) => variant.optionValueIds.includes(otherValue)) &&
        (variant.available > 0 || variant.allowBackorder),
    );
  }

  const price = activeVariant ?? defaultVariant;
  const purchasable = Boolean(activeVariant && (activeVariant.available > 0 || activeVariant.allowBackorder));
  const maxQuantity = activeVariant
    ? activeVariant.allowBackorder
      ? 20
      : Math.max(1, Math.min(20, activeVariant.available))
    : 1;

  async function addToBasket(): Promise<boolean> {
    if (!activeVariant) {
      toast.error("Choose an option first.");
      return false;
    }
    return add(activeVariant.id, Math.min(quantity, maxQuantity), { silent: true });
  }

  const galleryImages = useMemo(() => {
    if (!activeVariant) return images.filter((image) => image.variantId === null);
    // Images for the chosen colourway first, then the shared gallery. Matching
    // is by shared option value so a colour shot covers every size.
    const variantImages = images.filter(
      (image) =>
        image.variantId !== null &&
        image.optionValueIds.some((id) => activeVariant.optionValueIds.includes(id)),
    );
    const shared = images.filter((image) => image.variantId === null);
    return [...variantImages, ...shared];
  }, [activeVariant, images]);

  return (
    // min-w-0 on the grid and the gallery column: an auto-sized grid track
    // takes its max-content width, which lets the horizontally scrolling mobile
    // gallery stretch the whole page sideways.
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14">
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <ProductGallery images={galleryImages} activeVariantId={activeVariant?.id ?? null} title={productTitle} />
      </div>

      <div>
        {brand ? (
          <Link
            href={`/brand/${brand.slug}`}
            className="text-[11px] tracking-[0.12em] text-muted uppercase transition-colors hover:text-ink"
          >
            {brand.name}
          </Link>
        ) : null}

        <h1 className="mt-2 font-display text-[clamp(1.75rem,1.3rem+1.4vw,2.4rem)] leading-[1.08] tracking-[-0.02em]">
          {productTitle}
        </h1>

        {ratingCount > 0 ? (
          <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-[13px] text-muted hover:text-ink">
            <Rating value={rating} showCount={false} />
            <span className="tabular">
              {rating.toFixed(1)} · {ratingCount} {ratingCount === 1 ? "review" : "reviews"}
            </span>
          </a>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {price ? (
            <Price
              cents={price.priceCents}
              compareAtCents={price.compareAtCents}
              currency={price.currency}
              size="lg"
            />
          ) : null}
          {price?.compareAtCents ? <Badge tone="sale">Reduced</Badge> : null}
        </div>
        <p className="mt-1.5 text-[12px] text-muted">Includes VAT. Delivery calculated at checkout.</p>

        {options.length > 0 ? (
          <div className="mt-8 space-y-6">
            {options.map((option) => {
              const isSwatch = option.values.some((value) => value.swatchHex);
              return (
                <fieldset key={option.id}>
                  <legend className="mb-2.5 flex w-full items-baseline justify-between text-[13px]">
                    <span className="font-medium">{option.name}</span>
                    <span className="text-muted">
                      {option.values.find((value) => value.id === selection[option.id])?.value ?? "Select"}
                    </span>
                  </legend>

                  <div className={cn("flex flex-wrap gap-2")}>
                    {option.values.map((value) => {
                      const selected = selection[option.id] === value.id;
                      const available = isAvailable(option.id, value.id);
                      const stocked = inStock(option.id, value.id);

                      return (
                        <button
                          key={value.id}
                          type="button"
                          disabled={!available}
                          aria-pressed={selected}
                          onClick={() => {
                            setSelection((current) => ({ ...current, [option.id]: value.id }));
                            setQuantity(1);
                          }}
                          title={!stocked && available ? `${value.value} — out of stock` : value.value}
                          className={cn(
                            "relative min-w-11 border px-3 py-2.5 text-[13px] transition-all",
                            selected
                              ? "border-ink bg-ink text-paper"
                              : "border-line-strong text-ink hover:border-ink",
                            !available && "cursor-not-allowed opacity-35",
                            !stocked && available && !selected && "text-muted",
                            isSwatch && "flex items-center gap-2",
                          )}
                        >
                          {value.swatchHex ? (
                            <span
                              className="h-4 w-4 shrink-0 border border-ink/15"
                              style={{ backgroundColor: value.swatchHex }}
                              aria-hidden="true"
                            />
                          ) : null}
                          {value.value}
                          {!stocked && available ? (
                            <span className="pointer-events-none absolute inset-0 grid place-items-center">
                              <span className="h-px w-full rotate-[-14deg] bg-current opacity-30" />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        ) : null}

        <div className="mt-7" aria-live="polite">
          {!activeVariant ? (
            <p className="text-[13px] text-muted">Choose an option to see availability.</p>
          ) : activeVariant.available > 0 ? (
            activeVariant.isLowStock ? (
              <p className="text-[13px] text-warning">
                Only {activeVariant.available} left — usually dispatched same day.
              </p>
            ) : (
              <p className="text-[13px] text-success">In stock</p>
            )
          ) : activeVariant.allowBackorder ? (
            <p className="text-[13px] text-muted">On backorder — ships when stock arrives.</p>
          ) : (
            <p className="text-[13px] text-danger">Out of stock in this option.</p>
          )}
          {activeVariant ? (
            <p className="mt-1 font-mono text-[11px] text-muted-soft">SKU {activeVariant.sku}</p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <QuantityStepper
            value={quantity}
            max={maxQuantity}
            onChange={(next) => setQuantity(next)}
            label="Quantity"
            size="md"
          />

          <Button
            size="lg"
            className="min-w-44 flex-1"
            disabled={!purchasable || adding}
            onClick={async () => {
              setAdding(true);
              const ok = await addToBasket();
              setAdding(false);
              if (ok) toast.success(`${productTitle} added to your basket`);
            }}
          >
            {adding ? "Adding…" : purchasable ? "Add to basket" : "Unavailable"}
          </Button>

          <button
            type="button"
            disabled={savePending}
            aria-pressed={saved}
            onClick={() => {
              const next = !saved;
              setSaved(next);
              startSave(async () => {
                const result = await toggleWishlistAction({ productId });
                if (!result.ok) {
                  setSaved(!next);
                  toast.error(
                    result.code === "UNAUTHENTICATED"
                      ? "Sign in to save items to your wishlist."
                      : result.message,
                  );
                  return;
                }
                setSaved(result.data.saved);
                toast.success(result.data.saved ? "Saved to wishlist" : "Removed from wishlist");
              });
            }}
            aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
            className="grid h-13 w-13 place-items-center border border-line-strong transition-colors hover:border-ink"
          >
            <Heart size={19} strokeWidth={1.5} className={cn(saved && "fill-clay text-clay")} />
          </button>
        </div>

        <Button
          variant="outline"
          size="lg"
          full
          className="mt-3"
          disabled={!purchasable || buying}
          onClick={async () => {
            setBuying(true);
            const ok = await addToBasket();
            setBuying(false);
            if (ok) router.push("/checkout");
          }}
        >
          {buying ? "One moment…" : "Buy it now"}
        </Button>

        <ul className="mt-8 space-y-3 border-t border-line pt-6 text-[13px] text-ink-soft">
          <li className="flex gap-3">
            <Truck size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
            <span>{deliveryNote}</span>
          </li>
          <li className="flex gap-3">
            <Undo2 size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
            <span>{returnsNote}</span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
            <span>Secure checkout. Card details are handled by our payment provider, never by us.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
