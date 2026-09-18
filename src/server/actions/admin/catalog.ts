"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { conflict, notFound, toActionError, validationError, type ActionResult } from "@/server/errors";
import { requestIp, requirePermission } from "@/server/auth/session";
import { recordAudit } from "@/server/audit";
import { cuid } from "@/server/validation/common";
import { slugify, uniqueSlug } from "@/server/catalog/slug";

/**
 * Catalogue administration.
 *
 * Products, variants, categories and brands. Deletions are refused when the
 * record has history (orders reference it), and archiving is offered instead —
 * an order must always be able to show what was bought.
 */

const variantSchema = z.object({
  id: cuid.optional(),
  sku: z.string().trim().min(1).max(64),
  barcode: z.string().trim().max(64).optional().or(z.literal("")),
  title: z.string().trim().min(1).max(160),
  priceCents: z.number().int().min(0),
  salePriceCents: z.number().int().min(0).nullable().optional(),
  costPriceCents: z.number().int().min(0).nullable().optional(),
  weightGrams: z.number().int().min(0).nullable().optional(),
  lowStockThreshold: z.number().int().min(0).max(1000).default(5),
  allowBackorder: z.boolean().default(false),
  isActive: z.boolean().default(true),
  initialStock: z.number().int().min(0).max(100000).optional(),
});

const productSchema = z.object({
  id: cuid.optional(),
  title: z.string().trim().min(2).max(200),
  slug: z.string().trim().max(200).optional(),
  shortDescription: z.string().trim().max(400).optional().or(z.literal("")),
  description: z.string().trim().min(1).max(20000),
  brandId: cuid.nullable().optional(),
  taxClassId: cuid.nullable().optional(),
  categoryIds: z.array(cuid).min(1, "Choose at least one category"),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  isFeatured: z.boolean().default(false),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  metaTitle: z.string().trim().max(200).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(400).optional().or(z.literal("")),
  variants: z.array(variantSchema).min(1, "A product needs at least one variant"),
  attributes: z.record(z.string(), z.string().max(500)).default({}),
});

export async function saveProductAction(input: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const parsed = productSchema.parse(input);
    const actor = await requirePermission("product:write");

    // SKUs are the operational key: a duplicate breaks fulfilment.
    const skus = parsed.variants.map((variant) => variant.sku.toUpperCase());
    if (new Set(skus).size !== skus.length) {
      throw validationError("Each variant needs a unique SKU.");
    }
    const clashes = await prisma.productVariant.findMany({
      where: {
        sku: { in: skus },
        ...(parsed.id ? { productId: { not: parsed.id } } : {}),
      },
      select: { sku: true },
    });
    if (clashes.length > 0) {
      throw conflict(`These SKUs are already in use: ${clashes.map((entry) => entry.sku).join(", ")}`);
    }

    const slug = await uniqueSlug(parsed.slug || slugify(parsed.title), parsed.id);

    const productId = await prisma.$transaction(async (tx) => {
      const data = {
        title: parsed.title,
        slug,
        shortDescription: parsed.shortDescription || null,
        description: parsed.description,
        brandId: parsed.brandId ?? null,
        taxClassId: parsed.taxClassId ?? null,
        status: parsed.status,
        isFeatured: parsed.isFeatured,
        tags: parsed.tags,
        metaTitle: parsed.metaTitle || null,
        metaDescription: parsed.metaDescription || null,
        publishedAt: parsed.status === "ACTIVE" ? new Date() : null,
      };

      const product = parsed.id
        ? await tx.product.update({ where: { id: parsed.id }, data })
        : await tx.product.create({ data });

      // Categories: replace the set.
      await tx.productCategory.deleteMany({ where: { productId: product.id } });
      await tx.productCategory.createMany({
        data: parsed.categoryIds.map((categoryId, index) => ({
          productId: product.id,
          categoryId,
          isPrimary: index === 0,
        })),
      });

      // Attributes: replace the set, ignoring keys with no definition.
      await tx.productAttribute.deleteMany({ where: { productId: product.id } });
      const definitions = await tx.attributeDefinition.findMany({
        where: { key: { in: Object.keys(parsed.attributes) } },
        select: { id: true, key: true },
      });
      for (const definition of definitions) {
        const value = parsed.attributes[definition.key];
        if (value && value.trim()) {
          await tx.productAttribute.create({
            data: { productId: product.id, definitionId: definition.id, value: value.trim() },
          });
        }
      }

      // Variants: update in place, create new ones, and deactivate (never
      // delete) the ones removed, so order history stays intact.
      const keptIds: string[] = [];
      const defaultWarehouse = await tx.warehouse.findFirst({ where: { isDefault: true }, select: { id: true } });

      for (const [index, variant] of parsed.variants.entries()) {
        const variantData = {
          sku: variant.sku.toUpperCase(),
          barcode: variant.barcode || null,
          title: variant.title,
          priceCents: variant.priceCents,
          salePriceCents:
            variant.salePriceCents && variant.salePriceCents < variant.priceCents ? variant.salePriceCents : null,
          costPriceCents: variant.costPriceCents ?? null,
          currency: "GBP",
          weightGrams: variant.weightGrams ?? null,
          lowStockThreshold: variant.lowStockThreshold,
          allowBackorder: variant.allowBackorder,
          isActive: variant.isActive,
          position: index,
          isDefault: index === 0,
        };

        if (variant.id) {
          const updated = await tx.productVariant.update({ where: { id: variant.id }, data: variantData });
          keptIds.push(updated.id);
        } else {
          const created = await tx.productVariant.create({
            data: { ...variantData, productId: product.id },
          });
          keptIds.push(created.id);

          if (defaultWarehouse) {
            const item = await tx.inventoryItem.create({
              data: {
                variantId: created.id,
                warehouseId: defaultWarehouse.id,
                onHand: variant.initialStock ?? 0,
                reserved: 0,
              },
            });
            if (variant.initialStock && variant.initialStock > 0) {
              await tx.inventoryTransaction.create({
                data: {
                  inventoryItemId: item.id,
                  onHandDelta: variant.initialStock,
                  reason: "INITIAL",
                  note: "Opening stock set when the variant was created",
                  actorId: actor.id,
                },
              });
            }
          }
        }
      }

      await tx.productVariant.updateMany({
        where: { productId: product.id, id: { notIn: keptIds } },
        data: { isActive: false, deletedAt: new Date() },
      });

      return product.id;
    });

    await recordAudit({
      actor,
      action: parsed.id ? "product.updated" : "product.created",
      entityType: "Product",
      entityId: productId,
      metadata: { title: parsed.title, status: parsed.status, variants: parsed.variants.length },
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/products");
    revalidatePath(`/product/${slug}`);
    revalidatePath("/shop");
    return { ok: true, data: { id: productId, slug } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setProductStatusAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  try {
    const { productId, status } = z
      .object({ productId: cuid, status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]) })
      .parse(input);

    const actor = await requirePermission("product:write");
    const product = await prisma.product.update({
      where: { id: productId },
      data: { status, publishedAt: status === "ACTIVE" ? new Date() : undefined },
      select: { slug: true },
    });

    await recordAudit({
      actor,
      action: "product.status_changed",
      entityType: "Product",
      entityId: productId,
      metadata: { status },
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/products");
    revalidatePath(`/product/${product.slug}`);
    return { ok: true, data: { status } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function duplicateProductAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const { productId } = z.object({ productId: cuid }).parse(input);
    const actor = await requirePermission("product:write");

    const source = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        categories: true,
        attributes: true,
        media: { where: { variantId: null } },
        variants: { where: { deletedAt: null } },
      },
    });
    if (!source) throw notFound("Product not found");

    const slug = await uniqueSlug(`${source.slug}-copy`);

    const copy = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          title: `${source.title} (copy)`,
          slug,
          shortDescription: source.shortDescription,
          description: source.description,
          brandId: source.brandId,
          taxClassId: source.taxClassId,
          // A duplicate always starts as a draft: it is not ready to sell.
          status: "DRAFT",
          tags: source.tags,
          metaTitle: source.metaTitle,
          metaDescription: source.metaDescription,
        },
      });

      await tx.productCategory.createMany({
        data: source.categories.map((entry) => ({
          productId: created.id,
          categoryId: entry.categoryId,
          isPrimary: entry.isPrimary,
        })),
      });

      await tx.productAttribute.createMany({
        data: source.attributes.map((attribute) => ({
          productId: created.id,
          definitionId: attribute.definitionId,
          value: attribute.value,
        })),
      });

      await tx.productMedia.createMany({
        data: source.media.map((media) => ({
          productId: created.id,
          url: media.url,
          alt: media.alt,
          kind: media.kind,
          width: media.width,
          height: media.height,
          position: media.position,
          credit: media.credit,
        })),
      });

      const warehouse = await tx.warehouse.findFirst({ where: { isDefault: true }, select: { id: true } });

      for (const [index, variant] of source.variants.entries()) {
        const createdVariant = await tx.productVariant.create({
          data: {
            productId: created.id,
            sku: `${variant.sku}-C${Date.now().toString().slice(-4)}${index}`,
            title: variant.title,
            priceCents: variant.priceCents,
            salePriceCents: variant.salePriceCents,
            costPriceCents: variant.costPriceCents,
            currency: variant.currency,
            weightGrams: variant.weightGrams,
            lowStockThreshold: variant.lowStockThreshold,
            allowBackorder: variant.allowBackorder,
            position: variant.position,
            isDefault: variant.isDefault,
          },
        });
        if (warehouse) {
          // Stock is never copied: a new SKU starts at zero.
          await tx.inventoryItem.create({
            data: { variantId: createdVariant.id, warehouseId: warehouse.id, onHand: 0, reserved: 0 },
          });
        }
      }

      return created;
    });

    await recordAudit({
      actor,
      action: "product.duplicated",
      entityType: "Product",
      entityId: copy.id,
      metadata: { sourceId: productId },
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/products");
    return { ok: true, data: { id: copy.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteProductAction(input: unknown): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const { productId } = z.object({ productId: cuid }).parse(input);
    const actor = await requirePermission("product:delete");

    // If it has ever been ordered, it cannot be deleted — history depends on it.
    const orderedCount = await prisma.orderItem.count({ where: { variant: { productId } } });
    if (orderedCount > 0) {
      await prisma.product.update({
        where: { id: productId },
        data: { status: "ARCHIVED", deletedAt: new Date() },
      });
      await recordAudit({
        actor,
        action: "product.archived",
        entityType: "Product",
        entityId: productId,
        metadata: { reason: "has order history" },
        ipAddress: await requestIp(),
      });
      revalidatePath("/admin/products");
      return { ok: true, data: { deleted: false } };
    }

    await prisma.product.delete({ where: { id: productId } });
    await recordAudit({
      actor,
      action: "product.deleted",
      entityType: "Product",
      entityId: productId,
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/products");
    return { ok: true, data: { deleted: true } };
  } catch (error) {
    return toActionError(error);
  }
}

// ---------------------------------------------------------------- categories

const categorySchema = z.object({
  id: cuid.optional(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  parentId: cuid.nullable().optional(),
  position: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  metaTitle: z.string().trim().max(200).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(400).optional().or(z.literal("")),
});

export async function saveCategoryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = categorySchema.parse(input);
    const actor = await requirePermission("category:write");

    if (parsed.id && parsed.parentId === parsed.id) {
      throw validationError("A category cannot be its own parent.");
    }

    const slug = await uniqueSlug(parsed.slug || slugify(parsed.name), undefined, "category", parsed.id);

    const data = {
      name: parsed.name,
      slug,
      description: parsed.description || null,
      parentId: parsed.parentId ?? null,
      position: parsed.position,
      isActive: parsed.isActive,
      isFeatured: parsed.isFeatured,
      imageUrl: parsed.imageUrl || null,
      imageAlt: parsed.imageUrl ? `${parsed.name} category image` : null,
      metaTitle: parsed.metaTitle || null,
      metaDescription: parsed.metaDescription || null,
    };

    const category = parsed.id
      ? await prisma.category.update({ where: { id: parsed.id }, data })
      : await prisma.category.create({ data });

    await recordAudit({
      actor,
      action: parsed.id ? "category.updated" : "category.created",
      entityType: "Category",
      entityId: category.id,
      metadata: { name: parsed.name },
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/categories");
    revalidatePath("/");
    return { ok: true, data: { id: category.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteCategoryAction(input: unknown): Promise<ActionResult<{ deleted: true }>> {
  try {
    const { categoryId } = z.object({ categoryId: cuid }).parse(input);
    const actor = await requirePermission("category:write");

    const [productCount, childCount] = await Promise.all([
      prisma.productCategory.count({ where: { categoryId } }),
      prisma.category.count({ where: { parentId: categoryId } }),
    ]);
    if (productCount > 0) throw conflict("Move or remove the products in this category first.");
    if (childCount > 0) throw conflict("Remove the subcategories first.");

    await prisma.category.delete({ where: { id: categoryId } });
    await recordAudit({
      actor,
      action: "category.deleted",
      entityType: "Category",
      entityId: categoryId,
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/categories");
    return { ok: true, data: { deleted: true } };
  } catch (error) {
    return toActionError(error);
  }
}

// -------------------------------------------------------------------- brands

export async function saveBrandAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = z
      .object({
        id: cuid.optional(),
        name: z.string().trim().min(1).max(120),
        slug: z.string().trim().max(120).optional(),
        description: z.string().trim().max(1000).optional().or(z.literal("")),
        websiteUrl: z.string().trim().max(300).optional().or(z.literal("")),
        isFeatured: z.boolean().default(false),
        isActive: z.boolean().default(true),
      })
      .parse(input);

    const actor = await requirePermission("brand:write");
    const slug = await uniqueSlug(parsed.slug || slugify(parsed.name), undefined, "brand", parsed.id);

    const data = {
      name: parsed.name,
      slug,
      description: parsed.description || null,
      websiteUrl: parsed.websiteUrl || null,
      isFeatured: parsed.isFeatured,
      isActive: parsed.isActive,
    };

    const brand = parsed.id
      ? await prisma.brand.update({ where: { id: parsed.id }, data })
      : await prisma.brand.create({ data });

    await recordAudit({
      actor,
      action: parsed.id ? "brand.updated" : "brand.created",
      entityType: "Brand",
      entityId: brand.id,
      metadata: { name: parsed.name },
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/brands");
    return { ok: true, data: { id: brand.id } };
  } catch (error) {
    return toActionError(error);
  }
}
