import "server-only";
import { prisma } from "../db";
import { conflict, notFound, validationError } from "../errors";
import { requireActor } from "../auth/session";
import { logger } from "../logger";

/**
 * Reviews.
 *
 * Verified-purchase status is derived from delivered orders rather than
 * claimed by the reviewer. One review per person per product, and everything
 * starts life in PENDING moderation — published reviews are the exception the
 * moderator makes, not the default.
 */

export type ReviewInput = {
  productId: string;
  rating: number;
  title?: string;
  body: string;
};

const MIN_BODY = 20;
const MAX_BODY = 4000;

/** True when this customer has an order containing the product that reached delivery. */
export async function hasPurchased(userId: string, productId: string): Promise<boolean> {
  const count = await prisma.orderItem.count({
    where: {
      variant: { productId },
      order: { userId, status: { in: ["DELIVERED", "SHIPPED", "RETURN_REQUESTED", "RETURNED"] } },
    },
  });
  return count > 0;
}

export async function submitReview(input: ReviewInput) {
  const actor = await requireActor();

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw validationError("Choose a rating between 1 and 5 stars.");
  }
  const body = input.body.trim();
  if (body.length < MIN_BODY) {
    throw validationError(`Please write at least ${MIN_BODY} characters so the review is useful.`);
  }
  if (body.length > MAX_BODY) throw validationError("That review is too long.");

  const product = await prisma.product.findFirst({
    where: { id: input.productId, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  if (!product) throw notFound("That product is no longer available.");

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId: input.productId, userId: actor.id } },
    select: { id: true },
  });
  if (existing) throw conflict("You have already reviewed this product.");

  const verified = await hasPurchased(actor.id, input.productId);

  const review = await prisma.review.create({
    data: {
      productId: input.productId,
      userId: actor.id,
      rating: input.rating,
      title: input.title?.trim() || null,
      body,
      isVerifiedPurchase: verified,
      status: "PENDING",
    },
  });

  logger.info("review.submitted", { reviewId: review.id, productId: input.productId, verified });
  return review;
}

/** Recompute the denormalised aggregates a product card reads. */
export async function refreshProductRating(productId: string): Promise<void> {
  const stats = await prisma.review.aggregate({
    where: { productId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAverageBps: Math.round((stats._avg.rating ?? 0) * 100),
      ratingCount: stats._count,
    },
  });
}

export async function listPublishedReviews(productId: string, options: { take?: number; skip?: number } = {}) {
  const [reviews, total, distribution] = await Promise.all([
    prisma.review.findMany({
      where: { productId, status: "PUBLISHED" },
      orderBy: [{ isVerifiedPurchase: "desc" }, { helpfulCount: "desc" }, { createdAt: "desc" }],
      take: options.take ?? 6,
      skip: options.skip ?? 0,
      include: {
        user: { select: { name: true } },
        media: { select: { url: true, alt: true } },
      },
    }),
    prisma.review.count({ where: { productId, status: "PUBLISHED" } }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { productId, status: "PUBLISHED" },
      _count: true,
    }),
  ]);

  const counts = new Map(distribution.map((row) => [row.rating, row._count]));

  return {
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      createdAt: review.createdAt,
      isVerifiedPurchase: review.isVerifiedPurchase,
      helpfulCount: review.helpfulCount,
      // First name plus an initial: enough to feel human, not enough to identify.
      authorName: displayName(review.user.name),
      media: review.media,
    })),
    total,
    distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: counts.get(rating) ?? 0 })),
  };
}

function displayName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export async function moderateReview(
  reviewId: string,
  status: "PUBLISHED" | "REJECTED",
  note?: string,
): Promise<void> {
  const review = await prisma.review.update({
    where: { id: reviewId },
    data: { status, moderationNote: note ?? null },
    select: { productId: true },
  });
  await refreshProductRating(review.productId);
}
