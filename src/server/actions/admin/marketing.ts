"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { conflict, toActionError, validationError, type ActionResult } from "@/server/errors";
import { requestIp, requirePermission } from "@/server/auth/session";
import { recordAudit } from "@/server/audit";
import { cuid } from "@/server/validation/common";

/** Coupons, homepage content and store settings. */

const couponSchema = z
  .object({
    id: cuid.optional(),
    code: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Codes can use letters, numbers, hyphens and underscores only")
      .transform((value) => value.toUpperCase()),
    description: z.string().trim().max(200).optional().or(z.literal("")),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
    /** Basis points for PERCENTAGE, minor units for FIXED_AMOUNT. */
    discountValue: z.number().int().min(0),
    minSubtotalCents: z.number().int().min(0).nullable().optional(),
    maxDiscountCents: z.number().int().min(0).nullable().optional(),
    usageLimit: z.number().int().min(1).nullable().optional(),
    usageLimitPerUser: z.number().int().min(1).nullable().optional(),
    startsAt: z.string().optional().or(z.literal("")),
    endsAt: z.string().optional().or(z.literal("")),
    isActive: z.boolean().default(true),
    scope: z.enum(["", "PRODUCT", "CATEGORY", "BRAND"]).default(""),
    targetId: z.string().max(64).optional().or(z.literal("")),
  })
  .refine(
    (value) => value.discountType !== "PERCENTAGE" || value.discountValue <= 10_000,
    { message: "A percentage discount cannot exceed 100%.", path: ["discountValue"] },
  );

export async function saveCouponAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = couponSchema.parse(input);
    const actor = await requirePermission("promotion:write");

    const startsAt = parsed.startsAt ? new Date(parsed.startsAt) : null;
    const endsAt = parsed.endsAt ? new Date(parsed.endsAt) : null;
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw validationError("The end date must be after the start date.");
    }

    const existing = await prisma.coupon.findUnique({ where: { code: parsed.code }, select: { id: true } });
    if (existing && existing.id !== parsed.id) throw conflict("That code already exists.");

    const data = {
      code: parsed.code,
      description: parsed.description || null,
      discountType: parsed.discountType,
      discountValue: parsed.discountValue,
      currency: parsed.discountType === "FIXED_AMOUNT" ? "GBP" : null,
      minSubtotalCents: parsed.minSubtotalCents ?? null,
      maxDiscountCents: parsed.maxDiscountCents ?? null,
      usageLimit: parsed.usageLimit ?? null,
      usageLimitPerUser: parsed.usageLimitPerUser ?? null,
      startsAt,
      endsAt,
      isActive: parsed.isActive,
    };

    const coupon = parsed.id
      ? await prisma.coupon.update({ where: { id: parsed.id }, data })
      : await prisma.coupon.create({ data });

    await prisma.couponRestriction.deleteMany({ where: { couponId: coupon.id } });
    if (parsed.scope && parsed.targetId) {
      await prisma.couponRestriction.create({
        data: { couponId: coupon.id, scope: parsed.scope, targetId: parsed.targetId },
      });
    }

    await recordAudit({
      actor,
      action: parsed.id ? "coupon.updated" : "coupon.created",
      entityType: "Coupon",
      entityId: coupon.id,
      metadata: { code: parsed.code, type: parsed.discountType, value: parsed.discountValue },
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/promotions");
    return { ok: true, data: { id: coupon.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function toggleCouponAction(input: unknown): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const { couponId, isActive } = z.object({ couponId: cuid, isActive: z.boolean() }).parse(input);
    const actor = await requirePermission("promotion:write");

    await prisma.coupon.update({ where: { id: couponId }, data: { isActive } });
    await recordAudit({
      actor,
      action: "coupon.toggled",
      entityType: "Coupon",
      entityId: couponId,
      metadata: { isActive },
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/promotions");
    return { ok: true, data: { isActive } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateHomepageSectionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = z
      .object({
        id: cuid,
        title: z.string().trim().max(200).optional().or(z.literal("")),
        subtitle: z.string().trim().max(400).optional().or(z.literal("")),
        position: z.number().int().min(0).max(99),
        isActive: z.boolean(),
      })
      .parse(input);

    const actor = await requirePermission("content:write");

    await prisma.homepageSection.update({
      where: { id: parsed.id },
      data: {
        title: parsed.title || null,
        subtitle: parsed.subtitle || null,
        position: parsed.position,
        isActive: parsed.isActive,
      },
    });

    await recordAudit({
      actor,
      action: "homepage_section.updated",
      entityType: "HomepageSection",
      entityId: parsed.id,
      metadata: { isActive: parsed.isActive, position: parsed.position },
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/content");
    revalidatePath("/");
    return { ok: true, data: { id: parsed.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveBannerAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = z
      .object({
        id: cuid.optional(),
        placement: z.enum(["ANNOUNCEMENT", "HOMEPAGE_HERO", "CATEGORY_TOP", "CART_DRAWER"]),
        headline: z.string().trim().min(1).max(200),
        subtext: z.string().trim().max(300).optional().or(z.literal("")),
        ctaLabel: z.string().trim().max(60).optional().or(z.literal("")),
        ctaHref: z.string().trim().max(400).optional().or(z.literal("")),
        isActive: z.boolean().default(true),
        position: z.number().int().min(0).max(99).default(0),
      })
      .parse(input);

    const actor = await requirePermission("content:write");

    const data = {
      placement: parsed.placement,
      headline: parsed.headline,
      subtext: parsed.subtext || null,
      ctaLabel: parsed.ctaLabel || null,
      ctaHref: parsed.ctaHref || null,
      isActive: parsed.isActive,
      position: parsed.position,
    };

    const banner = parsed.id
      ? await prisma.banner.update({ where: { id: parsed.id }, data })
      : await prisma.banner.create({ data });

    await recordAudit({
      actor,
      action: parsed.id ? "banner.updated" : "banner.created",
      entityType: "Banner",
      entityId: banner.id,
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/content");
    revalidatePath("/");
    return { ok: true, data: { id: banner.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteBannerAction(input: unknown): Promise<ActionResult<{ deleted: true }>> {
  try {
    const { bannerId } = z.object({ bannerId: cuid }).parse(input);
    const actor = await requirePermission("content:write");

    await prisma.banner.delete({ where: { id: bannerId } });
    await recordAudit({
      actor,
      action: "banner.deleted",
      entityType: "Banner",
      entityId: bannerId,
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/content");
    revalidatePath("/");
    return { ok: true, data: { deleted: true } };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Store settings. Values are stored as JSON per key; each key has its own shape
 * so a malformed payload cannot corrupt an unrelated setting.
 */
const SETTING_SCHEMAS = {
  store: z.object({
    name: z.string().trim().min(1).max(120),
    tagline: z.string().trim().max(200).optional().or(z.literal("")),
    supportEmail: z.email().max(200),
    supportPhone: z.string().trim().max(40).optional().or(z.literal("")),
    addressLines: z.array(z.string().trim().max(120)).max(6).default([]),
    companyNumber: z.string().trim().max(60).optional().or(z.literal("")),
  }),
  commerce: z.object({
    currency: z.string().trim().length(3),
    locale: z.string().trim().max(10),
    defaultCountry: z.string().trim().length(2),
    freeShippingThresholdCents: z.number().int().min(0),
    returnWindowDays: z.number().int().min(0).max(365),
  }),
  seo: z.object({
    titleTemplate: z.string().trim().max(120),
    defaultDescription: z.string().trim().max(400),
    twitterHandle: z.string().trim().max(40).optional().or(z.literal("")),
  }),
  social: z.object({
    instagram: z.string().trim().max(300).optional().or(z.literal("")),
    pinterest: z.string().trim().max(300).optional().or(z.literal("")),
    email: z.string().trim().max(200).optional().or(z.literal("")),
  }),
} as const;

export async function saveSettingAction(input: unknown): Promise<ActionResult<{ key: string }>> {
  try {
    const { key, value } = z
      .object({ key: z.enum(["store", "commerce", "seo", "social"]), value: z.unknown() })
      .parse(input);

    const actor = await requirePermission("settings:write");
    const parsedValue = SETTING_SCHEMAS[key].parse(value);

    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value: parsedValue as never },
      update: { value: parsedValue as never },
    });

    await recordAudit({
      actor,
      action: "setting.updated",
      entityType: "SiteSetting",
      entityId: key,
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/settings");
    revalidatePath("/", "layout");
    return { ok: true, data: { key } };
  } catch (error) {
    return toActionError(error);
  }
}
