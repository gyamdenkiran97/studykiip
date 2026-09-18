import { randomUUID } from "node:crypto";
import { testDb } from "./db";

/**
 * Minimal, explicit fixtures. Each builder creates only what the test needs and
 * returns the ids, so a test reads as a description of the scenario.
 */

export async function createWarehouse(isDefault = true) {
  return testDb.warehouse.create({
    data: {
      name: "Test warehouse",
      code: `WH-${randomUUID().slice(0, 6)}`,
      countryCode: "GB",
      isDefault,
    },
  });
}

export async function createTaxClass(rateBps = 2000) {
  return testDb.taxClass.create({
    data: { name: `Rate ${rateBps}`, code: `rate-${rateBps}-${randomUUID().slice(0, 4)}`, rateBps },
  });
}

export async function createCustomer(overrides: { email?: string; name?: string } = {}) {
  return testDb.user.create({
    data: {
      name: overrides.name ?? "Test Customer",
      email: overrides.email ?? `customer-${randomUUID().slice(0, 8)}@example.test`,
      emailVerified: true,
      role: "CUSTOMER",
    },
  });
}

export async function createAddress(userId: string) {
  return testDb.address.create({
    data: {
      userId,
      fullName: "Test Customer",
      line1: "1 Test Street",
      city: "Leeds",
      region: "West Yorkshire",
      postalCode: "LS1 1AA",
      countryCode: "GB",
      isDefault: true,
    },
  });
}

export async function createShippingMethod(options: { priceCents?: number; freeOverCents?: number | null } = {}) {
  const zone = await testDb.shippingZone.create({
    data: { name: "UK", countryCodes: ["GB"] },
  });
  return testDb.shippingMethod.create({
    data: {
      zoneId: zone.id,
      name: "Standard",
      code: `std-${randomUUID().slice(0, 6)}`,
      priceCents: options.priceCents ?? 495,
      currency: "GBP",
      freeOverCents: options.freeOverCents === undefined ? 5000 : options.freeOverCents,
      minDeliveryDays: 3,
      maxDeliveryDays: 5,
    },
  });
}

/** A product with one variant and a given quantity on hand. */
export async function createProduct(options: {
  title?: string;
  priceCents?: number;
  salePriceCents?: number | null;
  stock?: number;
  warehouseId: string;
  taxClassId?: string;
  allowBackorder?: boolean;
  lowStockThreshold?: number;
}) {
  const slug = `product-${randomUUID().slice(0, 8)}`;

  const product = await testDb.product.create({
    data: {
      title: options.title ?? "Test Product",
      slug,
      description: "A product used in tests.",
      status: "ACTIVE",
      publishedAt: new Date(),
      taxClassId: options.taxClassId,
    },
  });

  const variant = await testDb.productVariant.create({
    data: {
      productId: product.id,
      sku: `SKU-${randomUUID().slice(0, 8).toUpperCase()}`,
      title: "Standard",
      priceCents: options.priceCents ?? 10_000,
      salePriceCents: options.salePriceCents ?? null,
      currency: "GBP",
      isDefault: true,
      allowBackorder: options.allowBackorder ?? false,
      lowStockThreshold: options.lowStockThreshold ?? 5,
    },
  });

  const inventory = await testDb.inventoryItem.create({
    data: {
      variantId: variant.id,
      warehouseId: options.warehouseId,
      onHand: options.stock ?? 10,
      reserved: 0,
    },
  });

  return { product, variant, inventory };
}

export async function createCart(options: {
  userId: string;
  items: Array<{ variantId: string; quantity: number }>;
  couponId?: string;
}) {
  const cart = await testDb.cart.create({
    data: {
      userId: options.userId,
      token: randomUUID(),
      currency: "GBP",
      couponId: options.couponId,
      items: { create: options.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })) },
    },
  });
  return cart;
}

export async function availableStock(variantId: string): Promise<number> {
  const items = await testDb.inventoryItem.findMany({ where: { variantId } });
  return items.reduce((total, item) => total + item.onHand - item.reserved, 0);
}
