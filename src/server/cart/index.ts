import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";
import { conflict, notFound, outOfStock, validationError } from "../errors";
import {
  computeBreakdown,
  effectivePrice,
  isCouponUsable,
  type PricingCoupon,
  type PricingLine,
} from "../pricing";
import { getActor } from "../auth/session";
import { logger } from "../logger";
import { isProduction } from "../env";

/**
 * Cart.
 *
 * A cart item stores a variant id and a quantity — nothing else. Every price,
 * discount and total shown to the customer is recomputed here from the current
 * database rows, so a tampered request can change *what* is in the basket but
 * never *what it costs*.
 *
 * Anonymous visitors are identified by a random token in an HttpOnly cookie.
 * On sign-in the anonymous cart is merged into the account's cart.
 */

export const CART_COOKIE = "kiip_cart";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days
const MAX_QUANTITY_PER_LINE = 20;

export type CartLine = {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  title: string;
  variantTitle: string;
  brandName: string | null;
  sku: string;
  imageUrl: string | null;
  imageAlt: string;
  quantity: number;
  unitPriceCents: number;
  compareAtCents: number | null;
  lineSubtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  available: number;
  allowBackorder: boolean;
  /** Set when the requested quantity exceeds what can actually be sold. */
  issue: "OUT_OF_STOCK" | "QUANTITY_REDUCED" | null;
  savedForLater: boolean;
};

export type CartView = {
  id: string | null;
  currency: string;
  lines: CartLine[];
  savedForLater: CartLine[];
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  coupon: { code: string; description: string | null } | null;
  couponMessage: string | null;
  shippingMethod: { id: string; name: string; description: string | null; priceCents: number } | null;
  freeShippingRemainingCents: number | null;
  hasIssues: boolean;
};

const CART_INCLUDE = {
  coupon: { include: { restrictions: true } },
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      variant: {
        include: {
          inventory: { select: { onHand: true, reserved: true } },
          media: { orderBy: { position: "asc" as const }, take: 1, select: { url: true, alt: true } },
          product: {
            select: {
              id: true,
              slug: true,
              title: true,
              brand: { select: { name: true } },
              taxClass: { select: { rateBps: true } },
              status: true,
              deletedAt: true,
              categories: { select: { categoryId: true } },
              brandId: true,
              media: { where: { variantId: null }, orderBy: { position: "asc" as const }, take: 1, select: { url: true, alt: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>;

export async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

/** Only callable from a Server Action or Route Handler (it may set a cookie). */
export async function ensureCart(): Promise<CartWithItems> {
  const actor = await getActor();
  const store = await cookies();
  let token = store.get(CART_COOKIE)?.value ?? null;

  if (actor) {
    const existing = await prisma.cart.findFirst({
      where: { userId: actor.id, status: "ACTIVE" },
      include: CART_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
    if (existing) {
      if (token && token !== existing.token) await mergeCarts(token, existing.id);
      setCartCookie(store, existing.token);
      return (await loadCart(existing.id))!;
    }
  }

  if (token) {
    const existing = await prisma.cart.findFirst({
      where: { token, status: "ACTIVE" },
      include: CART_INCLUDE,
    });
    if (existing) {
      // Claim an anonymous cart for the user who just signed in.
      if (actor && !existing.userId) {
        await prisma.cart.update({ where: { id: existing.id }, data: { userId: actor.id } });
      }
      return (await loadCart(existing.id))!;
    }
  }

  token = crypto.randomUUID();
  const created = await prisma.cart.create({
    data: { token, userId: actor?.id ?? null, currency: "GBP" },
  });
  setCartCookie(store, token);
  return (await loadCart(created.id))!;
}

function setCartCookie(store: Awaited<ReturnType<typeof cookies>>, token: string): void {
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

async function loadCart(id: string): Promise<CartWithItems | null> {
  return prisma.cart.findUnique({ where: { id }, include: CART_INCLUDE });
}

/** Read-only cart lookup, safe to call while rendering a page. */
export const findCurrentCart = cache(async (): Promise<CartWithItems | null> => {
  const actor = await getActor();
  if (actor) {
    const byUser = await prisma.cart.findFirst({
      where: { userId: actor.id, status: "ACTIVE" },
      include: CART_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
    if (byUser) return byUser;
  }
  const token = await readCartToken();
  if (!token) return null;
  return prisma.cart.findFirst({ where: { token, status: "ACTIVE" }, include: CART_INCLUDE });
});

/** Merge an anonymous cart into a destination cart, summing quantities. */
export async function mergeCarts(sourceToken: string, destinationCartId: string): Promise<void> {
  const source = await prisma.cart.findFirst({
    where: { token: sourceToken, status: "ACTIVE" },
    include: { items: true },
  });
  if (!source || source.id === destinationCartId) return;

  await prisma.$transaction(async (tx) => {
    for (const item of source.items) {
      const existing = await tx.cartItem.findUnique({
        where: { cartId_variantId: { cartId: destinationCartId, variantId: item.variantId } },
      });
      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: Math.min(MAX_QUANTITY_PER_LINE, existing.quantity + item.quantity) },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: destinationCartId,
            variantId: item.variantId,
            quantity: item.quantity,
            savedForLater: item.savedForLater,
          },
        });
      }
    }
    await tx.cart.update({ where: { id: source.id }, data: { status: "ABANDONED" } });
  });

  logger.info("cart.merged", { sourceCartId: source.id, destinationCartId });
}

function availableFor(variant: CartWithItems["items"][number]["variant"]): number {
  return variant.inventory.reduce((total, item) => total + item.onHand - item.reserved, 0);
}

/**
 * Build the view a customer sees. `shippingMethodId` lets checkout price a
 * chosen method; otherwise the cheapest active method for the country is used
 * as an estimate.
 */
export async function buildCartView(
  cart: CartWithItems | null,
  options: { shippingMethodId?: string | null; countryCode?: string } = {},
): Promise<CartView> {
  if (!cart || cart.items.length === 0) {
    return {
      id: cart?.id ?? null,
      currency: cart?.currency ?? "GBP",
      lines: [],
      savedForLater: [],
      itemCount: 0,
      subtotalCents: 0,
      discountCents: 0,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 0,
      coupon: null,
      couponMessage: null,
      shippingMethod: null,
      freeShippingRemainingCents: null,
      hasIssues: false,
    };
  }

  const active = cart.items.filter((item) => !item.savedForLater);
  const saved = cart.items.filter((item) => item.savedForLater);

  const pricingLines: PricingLine[] = [];
  const meta: Array<{ item: (typeof active)[number]; sellable: number; issue: CartLine["issue"] }> = [];

  for (const item of active) {
    const variant = item.variant;
    const product = variant.product;
    const unavailable =
      product.status !== "ACTIVE" || product.deletedAt !== null || !variant.isActive || variant.deletedAt !== null;
    const available = availableFor(variant);
    const sellable = unavailable
      ? 0
      : variant.allowBackorder
        ? item.quantity
        : Math.max(0, Math.min(item.quantity, available));

    const issue: CartLine["issue"] =
      sellable === 0 ? "OUT_OF_STOCK" : sellable < item.quantity ? "QUANTITY_REDUCED" : null;

    meta.push({ item, sellable, issue });

    if (sellable > 0) {
      pricingLines.push({
        variantId: variant.id,
        productId: product.id,
        categoryIds: product.categories.map((entry) => entry.categoryId),
        brandId: product.brandId,
        quantity: sellable,
        unitPriceCents: effectivePrice(variant).unitPriceCents,
        taxRateBps: product.taxClass?.rateBps ?? 2000,
      });
    }
  }

  const coupon: PricingCoupon | null = cart.coupon
    ? {
        id: cart.coupon.id,
        code: cart.coupon.code,
        discountType: cart.coupon.discountType,
        discountValue: cart.coupon.discountValue,
        minSubtotalCents: cart.coupon.minSubtotalCents,
        maxDiscountCents: cart.coupon.maxDiscountCents,
        restrictions: cart.coupon.restrictions.map((restriction) => ({
          scope: restriction.scope,
          targetId: restriction.targetId,
        })),
      }
    : null;

  const shippingMethod = await resolveShippingMethod(options);
  const breakdown = computeBreakdown({
    lines: pricingLines,
    coupon,
    shipping: shippingMethod
      ? { priceCents: shippingMethod.priceCents, freeOverCents: shippingMethod.freeOverCents }
      : null,
  });

  const pricedByVariant = new Map(breakdown.lines.map((line) => [line.variantId, line]));

  const toLine = (entry: (typeof meta)[number], savedForLater: boolean): CartLine => {
    const { item, issue } = entry;
    const variant = item.variant;
    const product = variant.product;
    const price = effectivePrice(variant);
    const priced = pricedByVariant.get(variant.id);
    const image = variant.media[0] ?? product.media[0] ?? null;

    return {
      id: item.id,
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      variantTitle: variant.title,
      brandName: product.brand?.name ?? null,
      sku: variant.sku,
      imageUrl: image?.url ?? null,
      imageAlt: image?.alt ?? product.title,
      quantity: item.quantity,
      unitPriceCents: price.unitPriceCents,
      compareAtCents: price.compareAtCents,
      lineSubtotalCents: priced?.lineSubtotalCents ?? price.unitPriceCents * item.quantity,
      discountCents: priced?.discountCents ?? 0,
      totalCents: priced?.totalCents ?? price.unitPriceCents * item.quantity,
      currency: variant.currency,
      available: availableFor(variant),
      allowBackorder: variant.allowBackorder,
      issue: savedForLater ? null : issue,
      savedForLater,
    };
  };

  const lines = meta.map((entry) => toLine(entry, false));
  const savedLines = saved.map((item) =>
    toLine({ item, sellable: item.quantity, issue: null }, true),
  );

  const freeThreshold = shippingMethod?.freeOverCents ?? null;
  const netSubtotal = breakdown.subtotalCents - breakdown.discountCents;

  return {
    id: cart.id,
    currency: cart.currency,
    lines,
    savedForLater: savedLines,
    itemCount: lines.reduce((total, line) => total + line.quantity, 0),
    subtotalCents: breakdown.subtotalCents,
    discountCents: breakdown.discountCents,
    shippingCents: breakdown.shippingCents,
    taxCents: breakdown.taxCents,
    totalCents: breakdown.totalCents,
    coupon: cart.coupon ? { code: cart.coupon.code, description: cart.coupon.description } : null,
    couponMessage: breakdown.couponRejectionReason,
    shippingMethod: shippingMethod
      ? {
          id: shippingMethod.id,
          name: shippingMethod.name,
          description: shippingMethod.description,
          priceCents: breakdown.shippingCents,
        }
      : null,
    freeShippingRemainingCents:
      freeThreshold !== null && netSubtotal < freeThreshold ? freeThreshold - netSubtotal : null,
    hasIssues: lines.some((line) => line.issue !== null),
  };
}

async function resolveShippingMethod(options: { shippingMethodId?: string | null; countryCode?: string }) {
  if (options.shippingMethodId) {
    const chosen = await prisma.shippingMethod.findFirst({
      where: { id: options.shippingMethodId, isActive: true },
    });
    if (chosen) return chosen;
  }
  const country = options.countryCode ?? "GB";
  return prisma.shippingMethod.findFirst({
    where: { isActive: true, zone: { isActive: true, countryCodes: { has: country } } },
    orderBy: [{ position: "asc" }, { priceCents: "asc" }],
  });
}

export async function addToCart(variantId: string, quantity: number): Promise<CartView> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
    throw validationError(`Quantity must be between 1 and ${MAX_QUANTITY_PER_LINE}.`);
  }

  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, isActive: true, deletedAt: null },
    include: {
      inventory: { select: { onHand: true, reserved: true } },
      product: { select: { status: true, deletedAt: true, title: true } },
    },
  });
  if (!variant || variant.product.status !== "ACTIVE" || variant.product.deletedAt) {
    throw notFound("That product is no longer available.");
  }

  const cart = await ensureCart();
  const existing = cart.items.find((item) => item.variantId === variantId);
  const requested = (existing && !existing.savedForLater ? existing.quantity : 0) + quantity;

  const available = variant.inventory.reduce((total, item) => total + item.onHand - item.reserved, 0);
  if (!variant.allowBackorder && requested > available) {
    throw outOfStock(
      available > 0
        ? `Only ${available} left in stock.`
        : `${variant.product.title} is out of stock.`,
      { available },
    );
  }
  if (requested > MAX_QUANTITY_PER_LINE) {
    throw validationError(`You can order at most ${MAX_QUANTITY_PER_LINE} of one item.`);
  }

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity },
    update: { quantity: requested, savedForLater: false },
  });
  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });

  return buildCartView(await loadCart(cart.id));
}

export async function updateCartItem(itemId: string, quantity: number): Promise<CartView> {
  const cart = await ensureCart();
  const item = cart.items.find((entry) => entry.id === itemId);
  if (!item) throw notFound("That item is no longer in your basket.");

  if (quantity <= 0) return removeCartItem(itemId);
  if (quantity > MAX_QUANTITY_PER_LINE) {
    throw validationError(`You can order at most ${MAX_QUANTITY_PER_LINE} of one item.`);
  }

  const available = availableFor(item.variant);
  if (!item.variant.allowBackorder && quantity > available) {
    throw outOfStock(available > 0 ? `Only ${available} left in stock.` : "That item is out of stock.", {
      available,
    });
  }

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  return buildCartView(await loadCart(cart.id));
}

export async function removeCartItem(itemId: string): Promise<CartView> {
  const cart = await ensureCart();
  if (!cart.items.some((item) => item.id === itemId)) {
    // Removing something already gone is not an error.
    return buildCartView(cart);
  }
  await prisma.cartItem.delete({ where: { id: itemId } });
  return buildCartView(await loadCart(cart.id));
}

export async function setSavedForLater(itemId: string, saved: boolean): Promise<CartView> {
  const cart = await ensureCart();
  if (!cart.items.some((item) => item.id === itemId)) throw notFound("That item is no longer in your basket.");
  await prisma.cartItem.update({ where: { id: itemId }, data: { savedForLater: saved } });
  return buildCartView(await loadCart(cart.id));
}

export async function applyCoupon(code: string): Promise<CartView> {
  const cart = await ensureCart();
  const normalised = code.trim().toUpperCase();
  if (!normalised) throw validationError("Enter a discount code.");

  const coupon = await prisma.coupon.findUnique({
    where: { code: normalised },
    include: { restrictions: true },
  });

  // One message for every failure mode: do not let the form enumerate codes.
  if (!coupon || !isCouponUsable(coupon)) throw validationError("That code is not valid.");

  const actor = await getActor();
  if (actor && coupon.usageLimitPerUser !== null) {
    const used = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId: actor.id },
    });
    if (used >= coupon.usageLimitPerUser) throw conflict("You have already used that code.");
  }

  await prisma.cart.update({ where: { id: cart.id }, data: { couponId: coupon.id } });
  const view = await buildCartView(await loadCart(cart.id));

  if (!view.coupon || (view.discountCents === 0 && coupon.discountType !== "FREE_SHIPPING")) {
    await prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
    const reason = view.couponMessage;
    throw validationError(
      reason === "MINIMUM_NOT_MET"
        ? "Your basket does not meet this code's minimum spend."
        : "That code does not apply to anything in your basket.",
    );
  }

  return view;
}

export async function removeCoupon(): Promise<CartView> {
  const cart = await ensureCart();
  await prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
  return buildCartView(await loadCart(cart.id));
}

/** Cheap count for the header badge. */
export async function getCartCount(): Promise<number> {
  const cart = await findCurrentCart();
  if (!cart) return 0;
  return cart.items
    .filter((item) => !item.savedForLater)
    .reduce((total, item) => total + item.quantity, 0);
}

export async function getCartView(options: { shippingMethodId?: string | null; countryCode?: string } = {}) {
  return buildCartView(await findCurrentCart(), options);
}
