/**
 * Pricing engine.
 *
 * Pure functions over integer minor units. Nothing here reads the database and
 * nothing here trusts a client: callers load the authoritative rows and pass
 * them in. This is the single place where an order total is decided.
 */

import { allocateByWeight, applyBps, clampNonNegative, sumCents } from "@/lib/money";

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
export type CouponScope = "PRODUCT" | "CATEGORY" | "BRAND";

export type PriceableVariant = {
  priceCents: number;
  salePriceCents: number | null;
};

export type EffectivePrice = {
  unitPriceCents: number;
  /** The struck-through "was" price, present only during a genuine markdown. */
  compareAtCents: number | null;
  isOnSale: boolean;
};

/** A sale price only counts when it is present, positive and actually lower. */
export function effectivePrice(variant: PriceableVariant): EffectivePrice {
  const { priceCents, salePriceCents } = variant;
  const onSale =
    salePriceCents !== null && salePriceCents > 0 && salePriceCents < priceCents;
  return {
    unitPriceCents: onSale ? salePriceCents! : priceCents,
    compareAtCents: onSale ? priceCents : null,
    isOnSale: onSale,
  };
}

export type PricingLine = {
  variantId: string;
  productId: string;
  categoryIds: readonly string[];
  brandId: string | null;
  quantity: number;
  unitPriceCents: number;
  /** Tax rate for this line's tax class, in basis points. */
  taxRateBps: number;
};

export type PricingCoupon = {
  id: string;
  code: string;
  discountType: DiscountType;
  /** Basis points for PERCENTAGE, minor units for FIXED_AMOUNT. */
  discountValue: number;
  minSubtotalCents: number | null;
  maxDiscountCents: number | null;
  restrictions: ReadonlyArray<{ scope: CouponScope; targetId: string }>;
};

export type PricingShipping = {
  priceCents: number;
  /** Subtotal at or above which shipping becomes free. */
  freeOverCents: number | null;
};

export type PricedLine = PricingLine & {
  lineSubtotalCents: number;
  discountCents: number;
  netCents: number;
  taxCents: number;
  totalCents: number;
};

export type PriceBreakdown = {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  couponApplied: boolean;
  couponRejectionReason: CouponRejection | null;
};

export type CouponRejection = "MINIMUM_NOT_MET" | "NO_ELIGIBLE_ITEMS";

function lineSubtotal(line: PricingLine): number {
  return line.unitPriceCents * line.quantity;
}

/** A line is eligible when the coupon is unrestricted or matches one restriction. */
export function isLineEligible(line: PricingLine, coupon: PricingCoupon): boolean {
  if (coupon.restrictions.length === 0) return true;
  return coupon.restrictions.some((restriction) => {
    switch (restriction.scope) {
      case "PRODUCT":
        return restriction.targetId === line.productId;
      case "CATEGORY":
        return line.categoryIds.includes(restriction.targetId);
      case "BRAND":
        return restriction.targetId === line.brandId;
      default:
        return false;
    }
  });
}

/**
 * Compute a complete breakdown.
 *
 * Order of operations, chosen to match what customers expect and what tax
 * authorities require: item discount first, tax on the discounted net, and
 * shipping considered against the pre-tax subtotal.
 */
export function computeBreakdown(input: {
  lines: readonly PricingLine[];
  coupon?: PricingCoupon | null;
  shipping?: PricingShipping | null;
}): PriceBreakdown {
  const { lines, coupon = null, shipping = null } = input;

  const subtotals = lines.map(lineSubtotal);
  const subtotalCents = sumCents(subtotals);

  let discountCents = 0;
  let freeShipping = false;
  let couponApplied = false;
  let couponRejectionReason: CouponRejection | null = null;
  let perLineDiscount = lines.map(() => 0);

  if (coupon) {
    if (coupon.minSubtotalCents !== null && subtotalCents < coupon.minSubtotalCents) {
      couponRejectionReason = "MINIMUM_NOT_MET";
    } else {
      const eligible = lines.map((line) => isLineEligible(line, coupon));
      const eligibleSubtotal = sumCents(subtotals.filter((_, index) => eligible[index]));

      if (coupon.discountType === "FREE_SHIPPING") {
        freeShipping = true;
        couponApplied = true;
      } else if (eligibleSubtotal <= 0) {
        couponRejectionReason = "NO_ELIGIBLE_ITEMS";
      } else {
        const raw =
          coupon.discountType === "PERCENTAGE"
            ? applyBps(eligibleSubtotal, coupon.discountValue)
            : Math.min(coupon.discountValue, eligibleSubtotal);
        const capped =
          coupon.maxDiscountCents !== null ? Math.min(raw, coupon.maxDiscountCents) : raw;
        discountCents = clampNonNegative(Math.min(capped, eligibleSubtotal));
        couponApplied = discountCents > 0;

        // Spread the discount across eligible lines without losing a penny.
        const weights = subtotals.map((value, index) => (eligible[index] ? value : 0));
        perLineDiscount = allocateByWeight(discountCents, weights);
      }
    }
  }

  const priced: PricedLine[] = lines.map((line, index) => {
    const lineSubtotalCents = subtotals[index];
    const lineDiscount = perLineDiscount[index];
    const netCents = lineSubtotalCents - lineDiscount;
    const taxCents = applyBps(netCents, line.taxRateBps);
    return {
      ...line,
      lineSubtotalCents,
      discountCents: lineDiscount,
      netCents,
      taxCents,
      totalCents: netCents + taxCents,
    };
  });

  let shippingCents = 0;
  if (shipping && lines.length > 0) {
    const qualifiesFree =
      shipping.freeOverCents !== null && subtotalCents - discountCents >= shipping.freeOverCents;
    shippingCents = freeShipping || qualifiesFree ? 0 : shipping.priceCents;
  }

  const taxCents = sumCents(priced.map((line) => line.taxCents));
  const totalCents = subtotalCents - discountCents + shippingCents + taxCents;

  return {
    lines: priced,
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents: clampNonNegative(totalCents),
    couponApplied,
    couponRejectionReason,
  };
}

/** Human-readable reason shown when a coupon cannot be applied. */
export const COUPON_REJECTION_MESSAGES: Record<CouponRejection, string> = {
  MINIMUM_NOT_MET: "Your basket does not meet this code's minimum spend.",
  NO_ELIGIBLE_ITEMS: "This code does not apply to anything in your basket.",
};
