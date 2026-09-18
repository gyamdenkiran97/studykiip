-- Integrity constraints and search indexes that the Prisma schema language
-- cannot express. These are the last line of defence: even a logic bug cannot
-- write negative stock, a negative price, or a nonsensical rating.

-- Inventory ----------------------------------------------------------------
ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_on_hand_non_negative" CHECK ("onHand" >= 0),
  ADD CONSTRAINT "inventory_reserved_non_negative" CHECK ("reserved" >= 0);

-- Note: `reserved <= onHand` is deliberately NOT enforced, because variants
-- with allowBackorder = true may legitimately reserve beyond physical stock.
-- Overselling of non-backorder variants is prevented by SELECT ... FOR UPDATE
-- row locks in src/server/inventory.

-- Prices -------------------------------------------------------------------
ALTER TABLE "product_variants"
  ADD CONSTRAINT "variant_price_non_negative" CHECK ("priceCents" >= 0),
  ADD CONSTRAINT "variant_sale_price_valid"
    CHECK ("salePriceCents" IS NULL OR ("salePriceCents" >= 0 AND "salePriceCents" < "priceCents")),
  ADD CONSTRAINT "variant_cost_price_non_negative"
    CHECK ("costPriceCents" IS NULL OR "costPriceCents" >= 0);

-- Quantities ---------------------------------------------------------------
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_item_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_item_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_item_refunded_within_quantity"
    CHECK ("refundedQuantity" >= 0 AND "refundedQuantity" <= "quantity");

-- Money --------------------------------------------------------------------
ALTER TABLE "orders"
  ADD CONSTRAINT "order_totals_non_negative"
    CHECK ("subtotalCents" >= 0 AND "discountCents" >= 0 AND "shippingCents" >= 0
           AND "taxCents" >= 0 AND "totalCents" >= 0 AND "refundedCents" >= 0),
  ADD CONSTRAINT "order_refund_within_total" CHECK ("refundedCents" <= "totalCents");

ALTER TABLE "payments"
  ADD CONSTRAINT "payment_amount_positive" CHECK ("amountCents" > 0),
  ADD CONSTRAINT "payment_refund_within_amount"
    CHECK ("refundedCents" >= 0 AND "refundedCents" <= "amountCents");

ALTER TABLE "refunds" ADD CONSTRAINT "refund_amount_positive" CHECK ("amountCents" > 0);

-- Reviews ------------------------------------------------------------------
ALTER TABLE "reviews" ADD CONSTRAINT "review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- Coupons ------------------------------------------------------------------
ALTER TABLE "coupons"
  ADD CONSTRAINT "coupon_discount_value_positive" CHECK ("discountValue" >= 0),
  ADD CONSTRAINT "coupon_percentage_within_range"
    CHECK ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 10000),
  ADD CONSTRAINT "coupon_window_ordered"
    CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "startsAt" < "endsAt");

-- Search indexes (trigram GIN) are declared in schema.prisma so that Prisma's
-- drift detection owns them; only the extension is created here as a guard for
-- databases where the migration runs before the extension is registered.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Frequently filtered combination that the schema language cannot express
-- (composite with a descending sort key on a mapped table).
CREATE INDEX IF NOT EXISTS "orders_status_created_idx" ON "orders" ("status", "createdAt" DESC);
