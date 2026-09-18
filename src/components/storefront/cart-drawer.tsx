"use client";

import Link from "next/link";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { ProductImage } from "@/components/ui/product-image";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { useCart } from "./cart-provider";

/** Slide-over basket. Totals come from the server view; nothing is summed here. */
export function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, update, remove } = useCart();
  const empty = cart.lines.length === 0;

  return (
    <Dialog.Root open={drawerOpen} onOpenChange={(open) => (open ? undefined : closeDrawer())}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 data-[state=open]:animate-[fade-in_220ms_ease-out] data-[state=closed]:animate-[fade-out_180ms_ease-in]"
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-paper shadow-float",
            "data-[state=open]:animate-[slide-in-right_320ms_var(--ease-out-soft)]",
            "data-[state=closed]:animate-[slide-out-right_240ms_var(--ease-in-out-soft)]",
          )}
        >
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <Dialog.Title className="font-display text-lg">
              Your basket
              {cart.itemCount > 0 ? (
                <span className="ml-2 text-[13px] font-normal text-muted tabular">
                  {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
                </span>
              ) : null}
            </Dialog.Title>
            <Dialog.Close className="grid h-9 w-9 place-items-center text-muted hover:text-ink" aria-label="Close basket">
              <X size={19} strokeWidth={1.5} />
            </Dialog.Close>
          </header>

          {cart.freeShippingRemainingCents !== null && !empty ? (
            <p className="border-b border-line bg-forest-tint px-5 py-2.5 text-[13px] text-forest">
              Spend {formatMoney(cart.freeShippingRemainingCents, cart.currency)} more for free delivery.
            </p>
          ) : null}

          {empty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
              <ShoppingBag size={34} strokeWidth={1} className="text-muted-soft" aria-hidden="true" />
              <div>
                <p className="font-display text-xl">Nothing here yet</p>
                <p className="mt-1.5 text-sm text-muted">
                  Once you add something, it will wait for you here.
                </p>
              </div>
              <Button asChild variant="outline" onClick={closeDrawer}>
                <Link href="/shop">Browse the mall</Link>
              </Button>
            </div>
          ) : (
            <>
              <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
                {cart.lines.map((line) => (
                  <li key={line.id} className="flex gap-4 py-4">
                    <Link
                      href={`/product/${line.slug}`}
                      onClick={closeDrawer}
                      className="relative block h-24 w-20 shrink-0 overflow-hidden bg-paper-deep"
                    >
                      <ProductImage src={line.imageUrl} alt={line.imageAlt} sizes="80px" />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {line.brandName ? (
                            <p className="text-[11px] tracking-[0.1em] text-muted uppercase">{line.brandName}</p>
                          ) : null}
                          <p className="truncate text-sm font-medium">
                            <Link href={`/product/${line.slug}`} onClick={closeDrawer}>
                              {line.title}
                            </Link>
                          </p>
                          {line.variantTitle !== "Standard" ? (
                            <p className="mt-0.5 text-[12px] text-muted">{line.variantTitle}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(line.id)}
                          aria-label={`Remove ${line.title} from basket`}
                          className="shrink-0 p-1 text-muted transition-colors hover:text-danger"
                        >
                          <Trash2 size={15} strokeWidth={1.5} />
                        </button>
                      </div>

                      {line.issue ? (
                        <p role="alert" className="mt-1 text-[12px] text-danger">
                          {line.issue === "OUT_OF_STOCK"
                            ? "Out of stock — remove to continue"
                            : `Only ${line.available} available`}
                        </p>
                      ) : null}

                      <div className="mt-auto flex items-center justify-between pt-2">
                        <QuantityStepper
                          value={line.quantity}
                          max={line.allowBackorder ? 20 : Math.max(1, line.available)}
                          onChange={(next) => update(line.id, next)}
                          label={`Quantity for ${line.title}`}
                        />
                        <Price
                          cents={line.lineSubtotalCents}
                          compareAtCents={line.compareAtCents ? line.compareAtCents * line.quantity : null}
                          currency={line.currency}
                          size="sm"
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <footer className="border-t border-line px-5 py-4">
                <dl className="space-y-1.5 text-sm">
                  <Row label="Subtotal" value={formatMoney(cart.subtotalCents, cart.currency)} />
                  {cart.discountCents > 0 ? (
                    <Row
                      label={`Discount${cart.coupon ? ` (${cart.coupon.code})` : ""}`}
                      value={`−${formatMoney(cart.discountCents, cart.currency)}`}
                      tone="clay"
                    />
                  ) : null}
                  <Row
                    label="Delivery"
                    value={cart.shippingCents === 0 ? "Free" : formatMoney(cart.shippingCents, cart.currency)}
                    muted
                  />
                  <Row label="Tax" value={formatMoney(cart.taxCents, cart.currency)} muted />
                  <div className="flex items-baseline justify-between border-t border-line pt-2.5">
                    <dt className="font-display text-base">Total</dt>
                    <dd className="tabular font-display text-lg">{formatMoney(cart.totalCents, cart.currency)}</dd>
                  </div>
                </dl>

                <Button asChild full size="lg" className="mt-4" disabled={cart.hasIssues}>
                  <Link href="/checkout" onClick={closeDrawer}>
                    Checkout
                  </Link>
                </Button>
                <Button asChild variant="link" full size="sm" className="mt-2">
                  <Link href="/cart" onClick={closeDrawer}>
                    View full basket
                  </Link>
                </Button>
              </footer>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "clay";
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={cn(muted ? "text-muted" : "text-ink-soft")}>{label}</dt>
      <dd className={cn("tabular", tone === "clay" ? "text-clay" : muted ? "text-muted" : "text-ink")}>{value}</dd>
    </div>
  );
}

export function QuantityStepper({
  value,
  max,
  onChange,
  label,
  size = "sm",
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const [busy, setBusy] = useState(false);

  async function change(next: number) {
    if (next < 1 || next > max || busy) return;
    setBusy(true);
    await onChange(next);
    setBusy(false);
  }

  const dimension = size === "sm" ? "h-8 w-8" : "h-10 w-10";

  return (
    <div className="inline-flex items-center border border-line-strong" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => change(value - 1)}
        disabled={value <= 1 || busy}
        aria-label="Decrease quantity"
        className={cn(dimension, "grid place-items-center text-ink transition-colors hover:bg-paper-deep disabled:opacity-35")}
      >
        <Minus size={14} strokeWidth={1.8} />
      </button>
      <span className={cn("tabular min-w-8 text-center text-sm", busy && "opacity-50")} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => change(value + 1)}
        disabled={value >= max || busy}
        aria-label="Increase quantity"
        className={cn(dimension, "grid place-items-center text-ink transition-colors hover:bg-paper-deep disabled:opacity-35")}
      >
        <Plus size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}
