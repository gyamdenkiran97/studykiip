import "server-only";
import { prisma } from "../db";
import { notFound, unauthenticated } from "../errors";
import { getActor, requireActor } from "../auth/session";
import { getProductCardsByIds } from "../catalog/queries";
import type { ProductCard } from "../catalog/types";

/**
 * Wishlist. Requires an account — a saved list that disappears with a cookie is
 * worse than no saved list at all.
 */

async function getOrCreateDefaultWishlist(userId: string) {
  const existing = await prisma.wishlist.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.wishlist.create({ data: { userId } });
}

export async function toggleWishlistItem(productId: string, variantId?: string | null): Promise<boolean> {
  const actor = await requireActor();
  const product = await prisma.product.findFirst({
    where: { id: productId, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  if (!product) throw notFound("That product is no longer available.");

  const wishlist = await getOrCreateDefaultWishlist(actor.id);
  const existing = await prisma.wishlistItem.findFirst({
    where: { wishlistId: wishlist.id, productId, variantId: variantId ?? null },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return false;
  }

  await prisma.wishlistItem.create({
    data: { wishlistId: wishlist.id, productId, variantId: variantId ?? null },
  });
  return true;
}

export async function getWishlistProductIds(): Promise<Set<string>> {
  const actor = await getActor();
  if (!actor) return new Set();
  const items = await prisma.wishlistItem.findMany({
    where: { wishlist: { userId: actor.id } },
    select: { productId: true },
  });
  return new Set(items.map((item) => item.productId));
}

export async function getWishlist(): Promise<ProductCard[]> {
  const actor = await getActor();
  if (!actor) throw unauthenticated();
  const items = await prisma.wishlistItem.findMany({
    where: { wishlist: { userId: actor.id } },
    orderBy: { createdAt: "desc" },
    select: { productId: true },
  });
  return getProductCardsByIds([...new Set(items.map((item) => item.productId))]);
}

export async function getWishlistCount(): Promise<number> {
  const actor = await getActor();
  if (!actor) return 0;
  return prisma.wishlistItem.count({ where: { wishlist: { userId: actor.id } } });
}
