import "server-only";
import { prisma } from "../db";
import { getActor } from "../auth/session";
import { readCartToken } from "../cart";
import { getProductCardsByIds } from "../catalog/queries";
import type { ProductCard } from "../catalog/types";
import { logger } from "../logger";

/**
 * Recently viewed products. Keyed to the account when signed in, otherwise to
 * the same anonymous token the cart uses, so the two stay consistent.
 */

const MAX_TRACKED = 24;

export async function recordProductView(productId: string): Promise<void> {
  const actor = await getActor();
  const token = actor ? null : await readCartToken();
  if (!actor && !token) return;

  try {
    if (actor) {
      await prisma.recentlyViewed.upsert({
        where: { userId_productId: { userId: actor.id, productId } },
        create: { userId: actor.id, productId },
        update: { viewedAt: new Date() },
      });
    } else if (token) {
      await prisma.recentlyViewed.upsert({
        where: { token_productId: { token, productId } },
        create: { token, productId },
        update: { viewedAt: new Date() },
      });
    }

    // Keep the list bounded.
    const scope = actor ? { userId: actor.id } : { token: token! };
    const rows = await prisma.recentlyViewed.findMany({
      where: scope,
      orderBy: { viewedAt: "desc" },
      select: { id: true },
      skip: MAX_TRACKED,
    });
    if (rows.length > 0) {
      await prisma.recentlyViewed.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    }
  } catch (error) {
    logger.warn("recently_viewed.write_failed", { productId, error });
  }
}

export async function getRecentlyViewed(options: { excludeProductId?: string; limit?: number } = {}) {
  const actor = await getActor();
  const token = actor ? null : await readCartToken();
  if (!actor && !token) return [] as ProductCard[];

  const rows = await prisma.recentlyViewed.findMany({
    where: {
      ...(actor ? { userId: actor.id } : { token: token! }),
      ...(options.excludeProductId ? { productId: { not: options.excludeProductId } } : {}),
    },
    orderBy: { viewedAt: "desc" },
    take: options.limit ?? 8,
    select: { productId: true },
  });

  return getProductCardsByIds(rows.map((row) => row.productId));
}
