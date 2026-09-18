import { BadgeCheck } from "lucide-react";
import { listPublishedReviews } from "@/server/reviews";
import { getActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { Rating } from "@/components/ui/rating";
import { ReviewForm } from "./review-form";

/** Reviews block: distribution summary, the reviews themselves, and the form. */
export async function ProductReviews({
  productId,
  productSlug,
  ratingAverage,
}: {
  productId: string;
  productSlug: string;
  ratingAverage: number;
}) {
  const [{ reviews, total, distribution }, actor] = await Promise.all([
    listPublishedReviews(productId, { take: 6 }),
    getActor(),
  ]);

  const alreadyReviewed = actor
    ? Boolean(
        await prisma.review.findUnique({
          where: { productId_userId: { productId, userId: actor.id } },
          select: { id: true },
        }),
      )
    : false;

  return (
    <section id="reviews" className="border-t border-line py-14 lg:py-20" aria-labelledby="reviews-title">
      <div className="grid gap-12 lg:grid-cols-[320px_1fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 id="reviews-title" className="text-display-3">
            Reviews
          </h2>

          {total > 0 ? (
            <>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="tabular font-display text-4xl">{ratingAverage.toFixed(1)}</span>
                <div>
                  <Rating value={ratingAverage} showCount={false} size="md" />
                  <p className="mt-1 text-[12.5px] text-muted">
                    {total} {total === 1 ? "review" : "reviews"}
                  </p>
                </div>
              </div>

              <ul className="mt-6 space-y-1.5">
                {distribution.map((row) => {
                  const percent = total > 0 ? Math.round((row.count / total) * 100) : 0;
                  return (
                    <li key={row.rating} className="flex items-center gap-3 text-[12px] text-muted">
                      <span className="tabular w-8">{row.rating}★</span>
                      <span className="h-1.5 flex-1 bg-line">
                        <span className="block h-full bg-gold" style={{ width: `${percent}%` }} />
                      </span>
                      <span className="tabular w-8 text-right">{row.count}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">No reviews yet. Be the first to write one.</p>
          )}

          <div className="mt-8">
            <ReviewForm
              productId={productId}
              productSlug={productSlug}
              signedIn={Boolean(actor)}
              alreadyReviewed={alreadyReviewed}
            />
          </div>
        </div>

        <div>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted">
              Once this product has been reviewed, the reviews will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {reviews.map((review) => (
                <li key={review.id} className="py-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Rating value={review.rating} showCount={false} />
                    {review.title ? <p className="font-medium">{review.title}</p> : null}
                    {review.isVerifiedPurchase ? (
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-success">
                        <BadgeCheck size={13} strokeWidth={1.8} aria-hidden="true" />
                        Verified purchase
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-soft">{review.body}</p>
                  <p className="mt-3 text-[12px] text-muted">
                    {review.authorName} ·{" "}
                    <time dateTime={review.createdAt.toISOString()}>
                      {review.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
