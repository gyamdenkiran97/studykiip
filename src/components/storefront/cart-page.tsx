"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { CartView } from "@/server/cart";
import { ProductImage } from "@/components/ui/product-image";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Input } from "@/components/ui/field";
import { QuantityStepper } from "./cart-drawer";
import { useCart } from "./cart-provider";

/**
 * Full basket page. The summary column sticks on desktop so the total and the
 * checkout button stay in view while the list is long.
 */
export function CartPageView({ initialCart }: { initialCart: CartView }) {
  const { cart: liveCart, update, remove, setSaved, applyCoupon, removeCoupon } = useCart();
  // The provider hydrates from the same server view; prefer it once it differs.
  const cart = liveCart.id ? liveCart : initialCart;

  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPending, setCouponPending] = useState(false);

  if (cart.lines.length === 0 && cart.savedForLater.length === 0) {
    return (
      <div className="shell flex flex-col items-center py-24 text-center">
        <ShoppingBag size={38} strokeWidth={0.9} className="text-muted-soft" aria-hidden="true" />
        <h1 className="mt-6 text-display-3">Your basket is empty</h1>
        <p className="mt-3 max-w-sm text-[15px] text-muted">
          Nothing in here yet. Everything you add will wait for you, on any device you sign in from.
        </p>
        <Button asChild size="lg" className="mt-7">
          <Link href="/shop">Start browsing</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="shell py-10 lg:py-14">
      <h1 className="text-display-2">Your basket</h1>
      <p className="mt-2 text-[14px] text-muted">
        {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
      </p>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
        <div>
          <ul className="divide-y divide-line border-y border-line">
            {cart.lines.map((line) => (
              <li key={line.id} className="flex gap-5 py-6">
                <Link
                  href={`/product/${line.slug}`}
                  className="relative block h-32 w-26 shrink-0 overflow-hidden bg-paper-deep sm:h-40 sm:w-32"
                >
                  <ProductImage src={line.imageUrl} alt={line.imageAlt} sizes="128px" />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {line.brandName ? (
                        <p className="text-[11px] tracking-[0.1em] text-muted uppercase">{line.brandName}</p>
                      ) : null}
                      <h2 className="mt-0.5 text-[15px] font-medium">
                        <Link href={`/product/${line.slug}`} className="hover:underline">
                          {line.title}
                        </Link>
                      </h2>
                      {line.variantTitle !== "Standard" ? (
                        <p className="mt-1 text-[13px] text-muted">{line.variantTitle}</p>
                      ) : null}
                      <p className="mt-1 font-mono text-[11px] text-muted-soft">{line.sku}</p>
                    </div>
                    <Price
                      cents={line.lineSubtotalCents}
                      compareAtCents={line.compareAtCents ? line.compareAtCents * line.quantity : null}
                      currency={line.currency}
                    />
                  </div>

                  {line.issue ? (
                    <p role="alert" className="mt-2 text-[13px] text-danger">
                      {line.issue === "OUT_OF_STOCK"
                        ? "This item is out of stock — remove it to continue."
                        : `Only ${line.available} available. The quantity will be reduced at checkout.`}
                    </p>
                  ) : null}

                  <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-4">
                    <QuantityStepper
                      value={line.quantity}
                      max={line.allowBackorder ? 20 : Math.max(1, line.available)}
                      onChange={(next) => update(line.id, next)}
                      label={`Quantity for ${line.title}`}
                    />
                    <button
                      type="button"
                      onClick={() => setSaved(line.id, true)}
                      className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
                    >
                      <Bookmark size={14} strokeWidth={1.6} />
                      Save for later
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(line.id)}
                      className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-danger"
                    >
                      <Trash2 size={14} strokeWidth={1.6} />
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {cart.savedForLater.length > 0 ? (
            <section className="mt-12" aria-labelledby="saved-title">
              <h2 id="saved-title" className="font-display text-xl">
                Saved for later
              </h2>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {cart.savedForLater.map((line) => (
                  <li key={line.id} className="flex items-center gap-4 py-4">
                    <Link
                      href={`/product/${line.slug}`}
                      className="relative block h-20 w-16 shrink-0 overflow-hidden bg-paper-deep"
                    >
                      <ProductImage src={line.imageUrl} alt={line.imageAlt} sizes="64px" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{line.title}</p>
                      <p className="text-[12px] text-muted">{line.variantTitle}</p>
                    </div>
                    <Price cents={line.unitPriceCents} currency={line.currency} size="sm" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSaved(line.id, false)}>
                        Move to basket
                      </Button>
                      <button
                        type="button"
                        onClick={() => remove(line.id)}
                        aria-label={`Remove ${line.title}`}
                        className="grid h-9 w-9 place-items-center text-muted hover:text-danger"
                      >
                        <Trash2 size={15} strokeWidth={1.6} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-labelledby="summary-title">
          <div className="border border-line bg-surface p-6">
            <h2 id="summary-title" className="font-display text-xl">
              Summary
            </h2>

            <form
              className="mt-5"
              onSubmit={async (event) => {
                event.preventDefault();
                setCouponError(null);
                setCouponPending(true);
                const ok = await applyCoupon(code);
                setCouponPending(false);
                if (ok) setCode("");
                else setCouponError("That code could not be applied.");
              }}
            >
              <label htmlFor="coupon" className="text-[13px] font-medium text-ink-soft">
                Discount code
              </label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="coupon"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="Enter code"
                  autoComplete="off"
                  aria-invalid={couponError ? true : undefined}
                  className="uppercase"
                />
                <Button type="submit" variant="secondary" disabled={couponPending || code.length < 2}>
                  {couponPending ? "…" : "Apply"}
                </Button>
              </div>
              {couponError ? (
                <p role="alert" className="mt-1.5 text-[12.5px] text-danger">
                  {couponError}
                </p>
              ) : null}
            </form>

            {cart.coupon ? (
              <div className="mt-3 flex items-center justify-between border border-clay/30 bg-clay-tint px-3 py-2">
                <span className="inline-flex items-center gap-2 text-[13px] text-clay-deep">
                  <Tag size={14} strokeWidth={1.7} />
                  {cart.coupon.code} applied
                </span>
                <button
                  type="button"
                  onClick={() => removeCoupon()}
                  aria-label="Remove discount code"
                  className="text-clay-deep hover:text-ink"
                >
                  <X size={15} strokeWidth={1.8} />
                </button>
              </div>
            ) : null}

            <dl className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm">
              <Row label="Subtotal" value={formatMoney(cart.subtotalCents, cart.currency)} />
              {cart.discountCents > 0 ? (
                <Row
                  label="Discount"
                  value={`−${formatMoney(cart.discountCents, cart.currency)}`}
                  className="text-clay"
                />
              ) : null}
              <Row
                label={cart.shippingMethod ? `Delivery · ${cart.shippingMethod.name}` : "Delivery"}
                value={cart.shippingCents === 0 ? "Free" : formatMoney(cart.shippingCents, cart.currency)}
              />
              <Row label="Estimated tax" value={formatMoney(cart.taxCents, cart.currency)} />
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-display text-lg">Total</dt>
                <dd className="tabular font-display text-xl">{formatMoney(cart.totalCents, cart.currency)}</dd>
              </div>
            </dl>

            {cart.freeShippingRemainingCents !== null ? (
              <p className="mt-3 text-[12.5px] text-forest">
                Spend {formatMoney(cart.freeShippingRemainingCents, cart.currency)} more for free delivery.
              </p>
            ) : null}

            <Button asChild full size="lg" className="mt-6" disabled={cart.hasIssues || cart.lines.length === 0}>
              <Link href="/checkout">Checkout</Link>
            </Button>
            {cart.hasIssues ? (
              <p className="mt-2 text-center text-[12.5px] text-danger">
                Resolve the flagged items to continue.
              </p>
            ) : null}
            <p className="mt-3 text-center text-[12px] text-muted">
              Taxes and delivery are confirmed at checkout.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("tabular", className)}>{value}</dd>
    </div>
  );
}
