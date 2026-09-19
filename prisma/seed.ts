/**
 * Demo data seed.
 *
 * Everything created here is clearly marked demo content: products come from
 * prisma/seed/data.ts, imagery is generated vector art, and accounts use
 * passwords supplied through the environment (never hard-coded). Running the
 * seed against a database that already has real orders is refused.
 */

import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { editorialImageSvg, productImageSvg } from "../src/server/media/placeholder";
import {
  ATTRIBUTE_DEFINITIONS,
  BRANDS,
  CATEGORIES,
  COUPONS,
  PRODUCTS,
  REVIEW_SNIPPETS,
  type ProductSeed,
} from "./seed/data";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const CURRENCY = "GBP";
const MEDIA_ROOT = path.join(process.cwd(), "public", "media");

function log(step: string, detail = "") {
  console.log(`  ${step.padEnd(28)} ${detail}`);
}

/** Password comes from the environment; if absent we generate one and show it once. */
function resolvePassword(envKey: string): { password: string; generated: boolean } {
  const fromEnv = process.env[envKey];
  if (fromEnv && fromEnv.length >= 10) return { password: fromEnv, generated: false };
  return { password: `${crypto.randomBytes(9).toString("base64url")}Aa1!`, generated: true };
}

function writeSvg(relativePath: string, svg: string): string {
  const full = path.join(MEDIA_ROOT, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, svg);
  return `/media/${relativePath}`;
}

/** Cartesian product of option values, in declaration order. */
function combinations(options: ProductSeed["options"]): string[][] {
  if (!options || options.length === 0) return [[]];
  return options.reduce<string[][]>(
    (acc, option) => acc.flatMap((prefix) => option.values.map((v) => [...prefix, v.value])),
    [[]],
  );
}

function skuFor(product: ProductSeed, combo: string[]): string {
  const base = product.slug
    .split("-")
    .map((part) => part.slice(0, 3).toUpperCase())
    .join("")
    .slice(0, 9);
  const suffix = combo.map((value) => value.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase()).join("-");
  return suffix ? `${base}-${suffix}` : base;
}

async function assertSafeToSeed() {
  const [orders, payments] = await Promise.all([
    prisma.order.count({ where: { status: { not: "PENDING_PAYMENT" } } }),
    prisma.payment.count({ where: { status: "SUCCEEDED" } }),
  ]);
  if ((orders > 0 || payments > 0) && process.env.SEED_FORCE !== "true") {
    throw new Error(
      "This database contains completed orders or payments. Refusing to seed demo data.\n" +
        "Set SEED_FORCE=true only if you are certain this is a disposable environment.",
    );
  }
}

async function resetDemoData() {
  // Ordered by dependency; the schema's cascades handle the rest.
  await prisma.$transaction([
    prisma.inventoryTransaction.deleteMany(),
    prisma.orderStatusEvent.deleteMany(),
    prisma.paymentEvent.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.trackingEvent.deleteMany(),
    prisma.shipment.deleteMany(),
    prisma.returnRequestItem.deleteMany(),
    prisma.returnRequest.deleteMany(),
    prisma.couponRedemption.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.wishlistItem.deleteMany(),
    prisma.wishlist.deleteMany(),
    prisma.recentlyViewed.deleteMany(),
    prisma.reviewMedia.deleteMany(),
    prisma.review.deleteMany(),
    prisma.inventoryItem.deleteMany(),
    prisma.variantOptionValue.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.productOptionValue.deleteMany(),
    prisma.productOption.deleteMany(),
    prisma.productMedia.deleteMany(),
    prisma.productAttribute.deleteMany(),
    prisma.productRelation.deleteMany(),
    prisma.productCategory.deleteMany(),
    prisma.product.deleteMany(),
    prisma.attributeDefinition.deleteMany(),
    prisma.category.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.couponRestriction.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.promotion.deleteMany(),
    prisma.shippingMethod.deleteMany(),
    prisma.shippingZone.deleteMany(),
    prisma.taxConfiguration.deleteMany(),
    prisma.taxClass.deleteMany(),
    prisma.warehouse.deleteMany(),
    prisma.navigationItem.deleteMany(),
    prisma.navigationMenu.deleteMany(),
    prisma.homepageSection.deleteMany(),
    prisma.banner.deleteMany(),
    prisma.searchSynonym.deleteMany(),
    prisma.searchQueryLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.emailLog.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.userPermission.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.address.deleteMany(),
    prisma.user.deleteMany(),
    prisma.siteSetting.deleteMany(),
  ]);
  fs.rmSync(MEDIA_ROOT, { recursive: true, force: true });
}

async function seedCommerceConfig() {
  const standard = await prisma.taxClass.create({
    data: { name: "Standard rate", code: "standard", rateBps: 2000, isDefault: true },
  });
  const zero = await prisma.taxClass.create({
    data: { name: "Zero rate (most food)", code: "zero", rateBps: 0 },
  });

  await prisma.taxConfiguration.createMany({
    data: [
      { countryCode: "GB", taxClassCode: "standard", rateBps: 2000, isInclusive: false },
      { countryCode: "GB", taxClassCode: "zero", rateBps: 0, isInclusive: false },
      { countryCode: "IE", taxClassCode: "standard", rateBps: 2300, isInclusive: false },
      { countryCode: "IE", taxClassCode: "zero", rateBps: 0, isInclusive: false },
    ],
  });

  const warehouse = await prisma.warehouse.create({
    data: { name: "Riverside Distribution Centre", code: "RDC-1", countryCode: "GB", city: "Leeds", isDefault: true },
  });
  await prisma.warehouse.create({
    data: { name: "Southern Overflow", code: "SOU-2", countryCode: "GB", city: "Reading" },
  });

  const ukZone = await prisma.shippingZone.create({
    data: { name: "United Kingdom", countryCodes: ["GB"] },
  });
  const euZone = await prisma.shippingZone.create({
    data: { name: "Ireland & EU", countryCodes: ["IE", "FR", "DE", "ES", "IT", "NL", "BE"] },
  });

  await prisma.shippingMethod.createMany({
    data: [
      { zoneId: ukZone.id, name: "Standard delivery", code: "uk-standard", description: "3–5 working days", priceCents: 495, currency: CURRENCY, freeOverCents: 5_000, minDeliveryDays: 3, maxDeliveryDays: 5, position: 0 },
      { zoneId: ukZone.id, name: "Express delivery", code: "uk-express", description: "Next working day if ordered before 2pm", priceCents: 995, currency: CURRENCY, minDeliveryDays: 1, maxDeliveryDays: 2, position: 1 },
      { zoneId: euZone.id, name: "International standard", code: "eu-standard", description: "5–8 working days", priceCents: 1_295, currency: CURRENCY, freeOverCents: 15_000, minDeliveryDays: 5, maxDeliveryDays: 8, position: 0 },
    ],
  });

  log("commerce config", "2 tax classes · 2 warehouses · 3 shipping methods");
  return { standard, zero, warehouse };
}

async function seedTaxonomy() {
  const categoryIds = new Map<string, string>();

  for (const [index, category] of CATEGORIES.entries()) {
    const heroUrl = writeSvg(
      `categories/${category.slug}.svg`,
      editorialImageSvg({ seed: category.slug, palette: category.palette, width: 1200, height: 900 }),
    );
    const parent = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        position: index,
        imageUrl: heroUrl,
        imageAlt: `${category.name} — generated editorial artwork`,
        isFeatured: category.featured ?? false,
        metaTitle: `${category.name} | Kiip Mall`,
        metaDescription: category.description,
      },
    });
    categoryIds.set(category.slug, parent.id);

    for (const [childIndex, child] of category.children.entries()) {
      const childHero = writeSvg(
        `categories/${child.slug}.svg`,
        editorialImageSvg({ seed: child.slug, palette: category.palette, width: 900, height: 700 }),
      );
      const created = await prisma.category.create({
        data: {
          name: child.name,
          slug: child.slug,
          description: child.description ?? `${child.name} from across the ${category.name.toLowerCase()} floor.`,
          parentId: parent.id,
          position: childIndex,
          imageUrl: childHero,
          imageAlt: `${child.name} — generated editorial artwork`,
          metaTitle: `${child.name} | ${category.name} | Kiip Mall`,
          metaDescription: child.description ?? `Shop ${child.name.toLowerCase()} at Kiip Mall.`,
        },
      });
      categoryIds.set(child.slug, created.id);
    }
  }

  const brandIds = new Map<string, string>();
  for (const brand of BRANDS) {
    const created = await prisma.brand.create({
      data: {
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        isFeatured: brand.featured ?? false,
        logoUrl: writeSvg(`brands/${brand.slug}.svg`, editorialImageSvg({ seed: brand.slug, palette: "oat", width: 600, height: 300 })),
        metaTitle: `${brand.name} | Kiip Mall`,
        metaDescription: brand.description,
      },
    });
    brandIds.set(brand.slug, created.id);
  }

  const attributeIds = new Map<string, string>();
  for (const [index, definition] of ATTRIBUTE_DEFINITIONS.entries()) {
    const created = await prisma.attributeDefinition.create({
      data: {
        key: definition.key,
        label: definition.label,
        type: definition.type,
        unit: definition.unit,
        options: definition.options ?? [],
        categoryId: definition.categorySlug ? categoryIds.get(definition.categorySlug) : undefined,
        isFilterable: definition.filterable ?? false,
        position: index,
      },
    });
    attributeIds.set(definition.key, created.id);
  }

  log("taxonomy", `${categoryIds.size} categories · ${brandIds.size} brands · ${attributeIds.size} attributes`);
  return { categoryIds, brandIds, attributeIds };
}

async function seedProducts(ctx: {
  categoryIds: Map<string, string>;
  brandIds: Map<string, string>;
  attributeIds: Map<string, string>;
  warehouseId: string;
  taxClassIds: { standard: string; zero: string };
}) {
  const productIds = new Map<string, string>();
  let variantCount = 0;

  for (const seed of PRODUCTS) {
    const categoryId = ctx.categoryIds.get(seed.category);
    if (!categoryId) throw new Error(`Unknown category ${seed.category} for ${seed.slug}`);

    const product = await prisma.product.create({
      data: {
        title: seed.title,
        slug: seed.slug,
        shortDescription: seed.short,
        description: seed.description,
        brandId: ctx.brandIds.get(seed.brand),
        taxClassId: seed.taxClass === "zero" ? ctx.taxClassIds.zero : ctx.taxClassIds.standard,
        status: "ACTIVE",
        isFeatured: seed.featured ?? false,
        publishedAt: new Date(Date.now() - Math.floor(Math.random() * 90) * 86_400_000),
        tags: seed.tags,
        metaTitle: `${seed.title} | ${BRANDS.find((b) => b.slug === seed.brand)?.name ?? "Kiip Mall"}`,
        metaDescription: seed.short,
        model3dUrl: seed.has3d ? `/media/models/${seed.slug}.glb` : null,
      },
    });
    productIds.set(seed.slug, product.id);

    await prisma.productCategory.create({
      data: { productId: product.id, categoryId, isPrimary: true },
    });
    for (const extra of seed.alsoIn ?? []) {
      const extraId = ctx.categoryIds.get(extra);
      if (extraId) {
        await prisma.productCategory.create({ data: { productId: product.id, categoryId: extraId } });
      }
    }

    // Product-level gallery: primary, secondary (used for the card hover), detail.
    const gallery = [0, 1, 2].map((index) =>
      writeSvg(
        `products/${seed.slug}-${index}.svg`,
        productImageSvg({ seed: seed.slug, archetype: seed.archetype, palette: seed.palette, variant: index }),
      ),
    );
    for (const [index, url] of gallery.entries()) {
      await prisma.productMedia.create({
        data: {
          productId: product.id,
          url,
          alt: `${seed.title} — view ${index + 1}`,
          kind: "IMAGE",
          width: 600,
          height: 720,
          position: index,
          credit: "Generated artwork, original to Kiip Mall",
        },
      });
    }

    for (const [key, value] of Object.entries(seed.attributes ?? {})) {
      const definitionId = ctx.attributeIds.get(key);
      if (definitionId) {
        await prisma.productAttribute.create({ data: { productId: product.id, definitionId, value } });
      }
    }

    // Options and their values.
    const valueIdByOptionValue = new Map<string, string>();
    for (const [optionIndex, option] of (seed.options ?? []).entries()) {
      const createdOption = await prisma.productOption.create({
        data: { productId: product.id, name: option.name, position: optionIndex },
      });
      for (const [valueIndex, value] of option.values.entries()) {
        const createdValue = await prisma.productOptionValue.create({
          data: {
            optionId: createdOption.id,
            value: value.value,
            swatchHex: value.swatchHex,
            position: valueIndex,
          },
        });
        valueIdByOptionValue.set(`${option.name}:${value.value}`, createdValue.id);
      }
    }

    const combos = combinations(seed.options);
    const stockList = Array.isArray(seed.stock)
      ? seed.stock
      : combos.map(() => seed.stock as number);

    for (const [index, combo] of combos.entries()) {
      const variantTitle = combo.length > 0 ? combo.join(" / ") : "Standard";
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: skuFor(seed, combo),
          barcode: `50${String(Math.abs(hashCode(seed.slug + index))).padStart(11, "0").slice(0, 11)}`,
          title: variantTitle,
          priceCents: seed.priceCents,
          salePriceCents: seed.salePriceCents ?? null,
          costPriceCents: seed.costPriceCents,
          currency: CURRENCY,
          weightGrams: seed.weightGrams,
          position: index,
          isDefault: index === 0,
          lowStockThreshold: seed.lowStockThreshold ?? 5,
        },
      });
      variantCount += 1;

      for (const [optionIndex, value] of combo.entries()) {
        const optionName = seed.options![optionIndex].name;
        const optionValueId = valueIdByOptionValue.get(`${optionName}:${value}`);
        if (optionValueId) {
          await prisma.variantOptionValue.create({ data: { variantId: variant.id, optionValueId } });
        }
      }

      // Colour-style options get their own image so the gallery changes with the swatch.
      const colourOptionIndex = (seed.options ?? []).findIndex((o) =>
        ["Colour", "Finish", "Glaze", "Cover", "Dial"].includes(o.name),
      );
      if (colourOptionIndex >= 0) {
        const colourValue = combo[colourOptionIndex];
        const swatch = seed.options![colourOptionIndex].values.find(
          (value) => value.value === colourValue,
        )?.swatchHex;
        const url = writeSvg(
          `products/${seed.slug}-${slugify(colourValue)}.svg`,
          productImageSvg({
            seed: `${seed.slug}:${colourValue}`,
            archetype: seed.archetype,
            palette: seed.palette,
            variant: 10 + colourOptionIndex,
            tintHex: swatch ?? undefined,
          }),
        );
        const existing = await prisma.productMedia.findFirst({
          where: { productId: product.id, url },
          select: { id: true },
        });
        // The image belongs to the colour, not to one size, so it stays bound to
        // the first variant of that colour; the storefront matches it to every
        // variant sharing the option value.
        if (!existing) {
          await prisma.productMedia.create({
            data: {
              productId: product.id,
              variantId: variant.id,
              url,
              alt: `${seed.title} in ${colourValue}`,
              kind: "IMAGE",
              width: 600,
              height: 720,
              position: 10 + index,
              credit: "Generated artwork, original to Kiip Mall",
            },
          });
        }
      }

      const quantity = stockList[index] ?? 0;
      const inventoryItem = await prisma.inventoryItem.create({
        data: { variantId: variant.id, warehouseId: ctx.warehouseId, onHand: quantity, reserved: 0 },
      });
      if (quantity > 0) {
        await prisma.inventoryTransaction.create({
          data: { inventoryItemId: inventoryItem.id, onHandDelta: quantity, reason: "INITIAL", note: "Demo opening stock" },
        });
      }
    }
  }

  // Related products: same category, plus a cross-sell and an upsell.
  for (const seed of PRODUCTS) {
    const sourceId = productIds.get(seed.slug)!;
    const siblings = PRODUCTS.filter((p) => p.category === seed.category && p.slug !== seed.slug).slice(0, 4);
    for (const [index, sibling] of siblings.entries()) {
      await prisma.productRelation.create({
        data: { sourceId, targetId: productIds.get(sibling.slug)!, kind: "RELATED", position: index },
      });
    }
    const crossSell = PRODUCTS.find((p) => p.brand === seed.brand && p.slug !== seed.slug && p.priceCents < seed.priceCents);
    if (crossSell) {
      await prisma.productRelation.create({
        data: { sourceId, targetId: productIds.get(crossSell.slug)!, kind: "CROSS_SELL" },
      });
    }
    const upsell = PRODUCTS.find((p) => p.category === seed.category && p.priceCents > seed.priceCents * 1.4);
    if (upsell) {
      await prisma.productRelation.create({
        data: { sourceId, targetId: productIds.get(upsell.slug)!, kind: "UPSELL" },
      });
    }
  }

  log("catalogue", `${productIds.size} products · ${variantCount} variants`);
  return productIds;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  return hash;
}

async function seedPeople() {
  const credentials = {
    admin: resolvePassword("SEED_ADMIN_PASSWORD"),
    customer: resolvePassword("SEED_CUSTOMER_PASSWORD"),
  };

  async function createUser(input: {
    name: string;
    email: string;
    role: "CUSTOMER" | "STAFF" | "MANAGER" | "ADMIN" | "SUPER_ADMIN";
    password: string;
    phone?: string;
  }) {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        emailVerified: true,
        role: input.role,
        phone: input.phone,
        marketingOptIn: input.role === "CUSTOMER",
      },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: await hashPassword(input.password),
      },
    });
    await prisma.wishlist.create({ data: { userId: user.id } });
    return user;
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@kiipmall.test";
  const customerEmail = process.env.SEED_CUSTOMER_EMAIL ?? "customer@kiipmall.test";

  const owner = await createUser({
    name: "Rowan Vale",
    email: adminEmail,
    role: "SUPER_ADMIN",
    password: credentials.admin.password,
  });
  const manager = await createUser({
    name: "Imani Osei",
    email: "manager@kiipmall.test",
    role: "MANAGER",
    password: credentials.admin.password,
  });
  const staff = await createUser({
    name: "Teodor Marek",
    email: "staff@kiipmall.test",
    role: "STAFF",
    password: credentials.admin.password,
  });
  const customer = await createUser({
    name: "Aoife Brennan",
    email: customerEmail,
    role: "CUSTOMER",
    password: credentials.customer.password,
    phone: "+44 7700 900412",
  });
  const customerTwo = await createUser({
    name: "Sana Qureshi",
    email: "sana@kiipmall.test",
    role: "CUSTOMER",
    password: credentials.customer.password,
  });
  const customerThree = await createUser({
    name: "Dermot Lynch",
    email: "dermot@kiipmall.test",
    role: "CUSTOMER",
    password: credentials.customer.password,
  });

  await prisma.address.createMany({
    data: [
      { userId: customer.id, type: "SHIPPING", fullName: "Aoife Brennan", line1: "14 Chandler Row", city: "Leeds", region: "West Yorkshire", postalCode: "LS1 4DT", countryCode: "GB", phone: "+44 7700 900412", isDefault: true },
      { userId: customer.id, type: "BILLING", fullName: "Aoife Brennan", line1: "14 Chandler Row", city: "Leeds", region: "West Yorkshire", postalCode: "LS1 4DT", countryCode: "GB", isDefault: true },
      { userId: customerTwo.id, type: "SHIPPING", fullName: "Sana Qureshi", line1: "4 Pollard Gardens", line2: "Flat 2", city: "Manchester", region: "Greater Manchester", postalCode: "M1 7EH", countryCode: "GB", isDefault: true },
      { userId: customerThree.id, type: "SHIPPING", fullName: "Dermot Lynch", line1: "27 Ashbourne Quay", city: "Dublin", region: "Leinster", postalCode: "D02 XY45", countryCode: "IE", isDefault: true },
    ],
  });

  log("accounts", `${adminEmail} (SUPER_ADMIN) · ${customerEmail} (CUSTOMER) · +4 more`);
  return { owner, manager, staff, customers: [customer, customerTwo, customerThree], credentials };
}

async function seedPromotions(categoryIds: Map<string, string>) {
  for (const coupon of COUPONS) {
    const created = await prisma.coupon.create({
      data: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        currency: coupon.discountType === "FIXED_AMOUNT" ? CURRENCY : null,
        minSubtotalCents: coupon.minSubtotalCents ?? null,
        maxDiscountCents: "maxDiscountCents" in coupon ? (coupon.maxDiscountCents as number) : null,
        usageLimit: "usageLimit" in coupon ? (coupon.usageLimit as number) : null,
        usageLimitPerUser: "usageLimitPerUser" in coupon ? (coupon.usageLimitPerUser as number) : null,
        startsAt: new Date(Date.now() - 7 * 86_400_000),
        endsAt: new Date(Date.now() + 60 * 86_400_000),
      },
    });
    const scopeCategory = "scopeCategory" in coupon ? (coupon.scopeCategory as string) : null;
    if (scopeCategory && categoryIds.has(scopeCategory)) {
      await prisma.couponRestriction.create({
        data: { couponId: created.id, scope: "CATEGORY", targetId: categoryIds.get(scopeCategory)! },
      });
    }
  }

  await prisma.promotion.create({
    data: {
      name: "Autumn edit — 10% off outerwear",
      description: "Applied automatically to the outerwear collection.",
      discountType: "PERCENTAGE",
      discountValue: 1000,
      scope: "CATEGORY",
      targetId: categoryIds.get("outerwear") ?? null,
      startsAt: new Date(Date.now() - 3 * 86_400_000),
      endsAt: new Date(Date.now() + 30 * 86_400_000),
      priority: 10,
    },
  });

  log("promotions", `${COUPONS.length} coupons · 1 automatic promotion`);
}

async function seedContent() {
  await prisma.siteSetting.createMany({
    data: [
      { key: "store", value: { name: "Kiip Mall", tagline: "A department store for things worth keeping", supportEmail: "help@kiipmall.test", supportPhone: "+44 20 7946 0102", addressLines: ["Placeholder House", "1 Example Street", "London", "EC1A 1AA"], companyNumber: "PLACEHOLDER — supply before launch" } },
      { key: "commerce", value: { currency: CURRENCY, locale: "en-GB", defaultCountry: "GB", freeShippingThresholdCents: 5000, returnWindowDays: 30 } },
      { key: "seo", value: { titleTemplate: "%s | Kiip Mall", defaultDescription: "A modern department store: fashion, electronics, beauty, home, furniture, sport and more.", twitterHandle: "@kiipmall" } },
      { key: "social", value: { instagram: "https://example.com/kiipmall", pinterest: "https://example.com/kiipmall", email: "hello@kiipmall.test" } },
      { key: "legal", value: { termsUpdatedAt: new Date().toISOString(), requiresLegalReview: true } },
    ],
  });

  await prisma.banner.createMany({
    data: [
      { placement: "ANNOUNCEMENT", headline: "Free UK delivery over £50", subtext: "Standard delivery, 3–5 working days", ctaLabel: "Shop new in", ctaHref: "/shop?sort=newest", position: 0 },
      { placement: "ANNOUNCEMENT", headline: "30-day returns on everything", ctaLabel: "Read our returns policy", ctaHref: "/returns", position: 1 },
      { placement: "CART_DRAWER", headline: "Spend £50 for free delivery", theme: "quiet", position: 0 },
    ],
  });

  const heroImage = writeSvg("editorial/hero-autumn.svg", editorialImageSvg({ seed: "hero-autumn-edit", palette: "clay", width: 1800, height: 1100 }));
  const editorialImage = writeSvg("editorial/workshop.svg", editorialImageSvg({ seed: "workshop-visit", palette: "forest", width: 1400, height: 1000 }));
  const campaignImage = writeSvg("editorial/campaign-home.svg", editorialImageSvg({ seed: "home-campaign", palette: "oat", width: 1400, height: 900 }));

  await prisma.homepageSection.createMany({
    data: [
      { kind: "HERO", title: "The considered department store", subtitle: "Eleven floors of things chosen to last longer than the season that sold them.", position: 0, config: { imageUrl: heroImage, imageAlt: "Generated editorial artwork in warm clay tones", primaryCta: { label: "Shop the mall", href: "/shop" }, secondaryCta: { label: "This week's edit", href: "/category/fashion" }, eyebrow: "Autumn edit" } },
      { kind: "CATEGORY_GRID", title: "Find your floor", subtitle: "Eleven departments, one basket.", position: 1, config: { categorySlugs: ["fashion", "electronics", "beauty", "home-living", "furniture", "sport"] } },
      { kind: "PRODUCT_CAROUSEL", title: "New this week", position: 2, config: { source: "newest", limit: 8 } },
      { kind: "EDITORIAL", title: "Inside the Kestrel workshop", subtitle: "Why a chair jointed with dowels outlives one held together with screws.", position: 3, config: { imageUrl: editorialImage, imageAlt: "Generated editorial artwork in deep green", href: "/category/furniture", ctaLabel: "Read the story", align: "left" } },
      { kind: "PRODUCT_CAROUSEL", title: "Most wanted", position: 4, config: { source: "trending", limit: 8 } },
      { kind: "SHOWCASE_3D", title: "Turn it over", subtitle: "A closer look at the Nocturne One, in three dimensions.", position: 5, config: { productSlug: "nocturne-over-ear-headphones" } },
      { kind: "BANNER", title: "Home, reduced", subtitle: "Up to 30% off selected furniture and lighting until the end of the month.", position: 6, config: { imageUrl: campaignImage, imageAlt: "Generated editorial artwork in oat tones", href: "/category/furniture", ctaLabel: "Shop the reductions" } },
      { kind: "BENEFITS", title: "How we work", position: 7, config: { items: [{ title: "Free delivery over £50", body: "Standard UK delivery, 3–5 working days." }, { title: "30-day returns", body: "Unused and in original packaging, no questions." }, { title: "Two-year guarantee", body: "On every piece of furniture and lighting." }, { title: "Real people", body: "Our support team answers within one working day." }] } },
      { kind: "NEWSLETTER", title: "The Thursday letter", subtitle: "One email a week: what arrived, what is leaving, and the occasional workshop visit.", position: 8, config: {} },
    ],
  });

  const menu = await prisma.navigationMenu.create({ data: { key: "primary", name: "Primary navigation" } });
  for (const [index, category] of CATEGORIES.entries()) {
    const parentItem = await prisma.navigationItem.create({
      data: { menuId: menu.id, label: category.name, href: `/category/${category.slug}`, position: index },
    });
    for (const [childIndex, child] of category.children.entries()) {
      await prisma.navigationItem.create({
        data: { menuId: menu.id, parentId: parentItem.id, label: child.name, href: `/category/${child.slug}`, position: childIndex },
      });
    }
    await prisma.navigationItem.create({
      data: {
        menuId: menu.id,
        parentId: parentItem.id,
        label: `All ${category.name.toLowerCase()}`,
        href: `/category/${category.slug}`,
        position: 90,
        isFeatured: true,
        imageUrl: `/media/categories/${category.slug}.svg`,
      },
    });
  }

  const footerMenu = await prisma.navigationMenu.create({ data: { key: "footer", name: "Footer" } });
  await prisma.navigationItem.createMany({
    data: [
      { menuId: footerMenu.id, label: "About", href: "/about", position: 0 },
      { menuId: footerMenu.id, label: "Contact", href: "/contact", position: 1 },
      { menuId: footerMenu.id, label: "FAQ", href: "/faq", position: 2 },
      { menuId: footerMenu.id, label: "Shipping", href: "/shipping", position: 3 },
      { menuId: footerMenu.id, label: "Returns", href: "/returns", position: 4 },
      { menuId: footerMenu.id, label: "Privacy", href: "/privacy", position: 5 },
      { menuId: footerMenu.id, label: "Terms", href: "/terms", position: 6 },
    ],
  });

  await prisma.searchSynonym.createMany({
    data: [
      { term: "trainers", synonyms: ["running", "sneakers", "shoes", "runner"] },
      { term: "sofa", synonyms: ["couch", "settee"] },
      { term: "headphones", synonyms: ["cans", "over-ear", "earphones"] },
      { term: "jumper", synonyms: ["sweater", "pullover", "knit"] },
      { term: "coat", synonyms: ["overcoat", "jacket", "outerwear"] },
    ],
  });

  log("content", "9 homepage sections · nav menus · banners · synonyms");
}

async function seedSocialProof(productIds: Map<string, string>, customers: Array<{ id: string }>) {
  let reviewCount = 0;
  const slugs = [...productIds.keys()];
  for (const [index, slug] of slugs.entries()) {
    const reviewsForProduct = index % 3 === 0 ? 3 : index % 3 === 1 ? 2 : 0;
    for (let i = 0; i < reviewsForProduct; i += 1) {
      const snippet = REVIEW_SNIPPETS[(index + i) % REVIEW_SNIPPETS.length];
      const user = customers[(index + i) % customers.length];
      await prisma.review
        .create({
          data: {
            productId: productIds.get(slug)!,
            userId: user.id,
            rating: snippet.rating,
            title: snippet.title,
            body: snippet.body,
            status: "PUBLISHED",
            isVerifiedPurchase: i === 0,
            helpfulCount: (index * 3 + i) % 11,
          },
        })
        .then(() => {
          reviewCount += 1;
        })
        .catch(() => undefined); // one review per user per product
    }
  }

  // Refresh denormalised rating aggregates.
  for (const [slug, id] of productIds) {
    const stats = await prisma.review.aggregate({
      where: { productId: id, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.product.update({
      where: { id },
      data: {
        ratingAverageBps: Math.round((stats._avg.rating ?? 0) * 100),
        ratingCount: stats._count,
        soldCount: (Math.abs(hashCode(slug)) % 240) + 3,
      },
    });
  }

  log("reviews", `${reviewCount} published reviews`);
}

async function main() {
  console.log("\nSeeding Kiip Mall demo data\n");
  await assertSafeToSeed();
  await resetDemoData();

  const { standard, zero, warehouse } = await seedCommerceConfig();
  const { categoryIds, brandIds, attributeIds } = await seedTaxonomy();
  const productIds = await seedProducts({
    categoryIds,
    brandIds,
    attributeIds,
    warehouseId: warehouse.id,
    taxClassIds: { standard: standard.id, zero: zero.id },
  });
  const people = await seedPeople();
  await seedPromotions(categoryIds);
  await seedContent();
  await seedSocialProof(productIds, people.customers);

  console.log("\nDemo data ready.\n");
  if (people.credentials.admin.generated || people.credentials.customer.generated) {
    console.log("  Generated demo passwords (shown once — set SEED_ADMIN_PASSWORD /");
    console.log("  SEED_CUSTOMER_PASSWORD in .env to choose your own):\n");
    if (people.credentials.admin.generated) {
      console.log(`    admin    ${process.env.SEED_ADMIN_EMAIL ?? "admin@kiipmall.test"}  ${people.credentials.admin.password}`);
    }
    if (people.credentials.customer.generated) {
      console.log(`    customer ${process.env.SEED_CUSTOMER_EMAIL ?? "customer@kiipmall.test"}  ${people.credentials.customer.password}`);
    }
    console.log("");
  }
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
