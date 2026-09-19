import { describe, expect, it } from "vitest";
import {
  computeBreakdown,
  effectivePrice,
  isCouponUsable,
  isLineEligible,
  type CouponWindow,
  type PricingCoupon,
  type PricingLine,
} from "@/server/pricing";

const line = (overrides: Partial<PricingLine> = {}): PricingLine => ({
  variantId: "v1",
  productId: "p1",
  categoryIds: ["c1"],
  brandId: "b1",
  quantity: 1,
  unitPriceCents: 10_000,
  taxRateBps: 2000,
  ...overrides,
});

const coupon = (overrides: Partial<PricingCoupon> = {}): PricingCoupon => ({
  id: "coupon1",
  code: "SAVE",
  discountType: "PERCENTAGE",
  discountValue: 1000,
  minSubtotalCents: null,
  maxDiscountCents: null,
  restrictions: [],
  ...overrides,
});

describe("effectivePrice", () => {
  it("uses the sale price only when it is genuinely lower", () => {
    expect(effectivePrice({ priceCents: 10_000, salePriceCents: 7_500 })).toEqual({
      unitPriceCents: 7_500,
      compareAtCents: 10_000,
      isOnSale: true,
    });
    expect(effectivePrice({ priceCents: 10_000, salePriceCents: 10_000 }).isOnSale).toBe(false);
    expect(effectivePrice({ priceCents: 10_000, salePriceCents: 0 }).isOnSale).toBe(false);
    expect(effectivePrice({ priceCents: 10_000, salePriceCents: null }).unitPriceCents).toBe(10_000);
  });
});

describe("computeBreakdown", () => {
  it("computes subtotal, tax and total for a simple basket", () => {
    const result = computeBreakdown({ lines: [line({ quantity: 2 })] });
    expect(result.subtotalCents).toBe(20_000);
    expect(result.taxCents).toBe(4_000);
    expect(result.totalCents).toBe(24_000);
  });

  it("taxes the discounted net, not the gross", () => {
    const result = computeBreakdown({ lines: [line()], coupon: coupon({ discountValue: 5000 }) });
    expect(result.discountCents).toBe(5_000);
    expect(result.taxCents).toBe(1_000); // 20% of the £50 net, not of £100
    expect(result.totalCents).toBe(6_000);
  });

  it("applies a fixed discount capped at the eligible subtotal", () => {
    const result = computeBreakdown({
      lines: [line({ unitPriceCents: 3_000 })],
      coupon: coupon({ discountType: "FIXED_AMOUNT", discountValue: 5_000 }),
    });
    expect(result.discountCents).toBe(3_000);
    expect(result.totalCents).toBe(0);
  });

  it("honours a maximum discount cap", () => {
    const result = computeBreakdown({
      lines: [line({ unitPriceCents: 100_000 })],
      coupon: coupon({ discountValue: 5000, maxDiscountCents: 2_000 }),
    });
    expect(result.discountCents).toBe(2_000);
  });

  it("rejects a coupon when the minimum spend is not met", () => {
    const result = computeBreakdown({
      lines: [line({ unitPriceCents: 1_000 })],
      coupon: coupon({ minSubtotalCents: 5_000 }),
    });
    expect(result.couponApplied).toBe(false);
    expect(result.couponRejectionReason).toBe("MINIMUM_NOT_MET");
    expect(result.discountCents).toBe(0);
  });

  it("only discounts lines matching a scoped coupon", () => {
    const scoped = coupon({
      discountValue: 5000,
      restrictions: [{ scope: "CATEGORY", targetId: "beauty" }],
    });
    const result = computeBreakdown({
      lines: [
        line({ variantId: "a", categoryIds: ["beauty"], unitPriceCents: 4_000 }),
        line({ variantId: "b", categoryIds: ["sport"], unitPriceCents: 6_000 }),
      ],
      coupon: scoped,
    });
    expect(result.discountCents).toBe(2_000);
    expect(result.lines[0].discountCents).toBe(2_000);
    expect(result.lines[1].discountCents).toBe(0);
  });

  it("reports when a scoped coupon matches nothing", () => {
    const result = computeBreakdown({
      lines: [line({ categoryIds: ["sport"] })],
      coupon: coupon({ restrictions: [{ scope: "CATEGORY", targetId: "beauty" }] }),
    });
    expect(result.couponRejectionReason).toBe("NO_ELIGIBLE_ITEMS");
  });

  it("splits an order-level discount across lines without losing a penny", () => {
    const result = computeBreakdown({
      lines: [
        line({ variantId: "a", unitPriceCents: 3_333 }),
        line({ variantId: "b", unitPriceCents: 3_333 }),
        line({ variantId: "c", unitPriceCents: 3_334 }),
      ],
      coupon: coupon({ discountType: "FIXED_AMOUNT", discountValue: 1_000 }),
    });
    const allocated = result.lines.reduce((total, l) => total + l.discountCents, 0);
    expect(allocated).toBe(1_000);
    expect(result.discountCents).toBe(1_000);
  });

  it("charges shipping unless the free threshold is met", () => {
    const shipping = { priceCents: 495, freeOverCents: 5_000 };
    const under = computeBreakdown({ lines: [line({ unitPriceCents: 4_000 })], shipping });
    expect(under.shippingCents).toBe(495);

    const over = computeBreakdown({ lines: [line({ unitPriceCents: 5_000 })], shipping });
    expect(over.shippingCents).toBe(0);
  });

  it("applies the threshold to the discounted subtotal", () => {
    const result = computeBreakdown({
      lines: [line({ unitPriceCents: 5_000 })],
      coupon: coupon({ discountType: "FIXED_AMOUNT", discountValue: 1_000 }),
      shipping: { priceCents: 495, freeOverCents: 5_000 },
    });
    expect(result.shippingCents).toBe(495);
  });

  it("zeroes shipping for a free-shipping coupon", () => {
    const result = computeBreakdown({
      lines: [line()],
      coupon: coupon({ discountType: "FREE_SHIPPING", discountValue: 0 }),
      shipping: { priceCents: 995, freeOverCents: null },
    });
    expect(result.shippingCents).toBe(0);
    expect(result.couponApplied).toBe(true);
  });

  it("charges no shipping on an empty basket", () => {
    const result = computeBreakdown({ lines: [], shipping: { priceCents: 995, freeOverCents: null } });
    expect(result.totalCents).toBe(0);
    expect(result.shippingCents).toBe(0);
  });

  it("matches coupon scopes correctly", () => {
    const l = line({ productId: "p9", brandId: "b9", categoryIds: ["c9"] });
    expect(isLineEligible(l, coupon({ restrictions: [{ scope: "PRODUCT", targetId: "p9" }] }))).toBe(true);
    expect(isLineEligible(l, coupon({ restrictions: [{ scope: "BRAND", targetId: "b9" }] }))).toBe(true);
    expect(isLineEligible(l, coupon({ restrictions: [{ scope: "CATEGORY", targetId: "nope" }] }))).toBe(false);
  });
});

describe("isCouponUsable", () => {
  const NOW = new Date("2026-06-15T12:00:00Z");
  const usable = (overrides: Partial<CouponWindow> = {}): CouponWindow => ({
    isActive: true,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    timesUsed: 0,
    ...overrides,
  });

  it("accepts an open-ended active coupon", () => {
    expect(isCouponUsable(usable(), NOW)).toBe(true);
  });

  it("rejects a coupon that has been switched off", () => {
    expect(isCouponUsable(usable({ isActive: false }), NOW)).toBe(false);
  });

  it("rejects a coupon whose campaign has not started", () => {
    expect(isCouponUsable(usable({ startsAt: new Date("2026-06-16T00:00:00Z") }), NOW)).toBe(false);
  });

  it("rejects a coupon whose campaign has ended", () => {
    expect(isCouponUsable(usable({ endsAt: new Date("2026-06-14T23:59:59Z") }), NOW)).toBe(false);
  });

  it("treats the window boundaries as inclusive", () => {
    expect(isCouponUsable(usable({ startsAt: NOW }), NOW)).toBe(true);
    expect(isCouponUsable(usable({ endsAt: NOW }), NOW)).toBe(true);
  });

  it("accepts a coupon inside its window", () => {
    const coupon = usable({
      startsAt: new Date("2026-06-01T00:00:00Z"),
      endsAt: new Date("2026-06-30T23:59:59Z"),
    });
    expect(isCouponUsable(coupon, NOW)).toBe(true);
  });

  it("rejects a coupon that has been used up", () => {
    expect(isCouponUsable(usable({ usageLimit: 100, timesUsed: 100 }), NOW)).toBe(false);
    expect(isCouponUsable(usable({ usageLimit: 100, timesUsed: 101 }), NOW)).toBe(false);
    expect(isCouponUsable(usable({ usageLimit: 100, timesUsed: 99 }), NOW)).toBe(true);
  });

  it("treats a null usage limit as unlimited", () => {
    expect(isCouponUsable(usable({ usageLimit: null, timesUsed: 10_000 }), NOW)).toBe(true);
  });
});
