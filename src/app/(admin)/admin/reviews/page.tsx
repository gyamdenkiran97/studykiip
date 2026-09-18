import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import { AdminFilters } from "@/components/admin/admin-filters";
import { Rating } from "@/components/ui/rating";
import { ReviewModeration } from "@/components/admin/review-moderation";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Reviews", robots: { index: false, follow: false } };

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requirePermission("review:moderate");
  const params = await searchParams;
  const status = ["PENDING", "PUBLISHED", "REJECTED"].includes(params.status ?? "")
    ? (params.status as "PENDING" | "PUBLISHED" | "REJECTED")
    : "PENDING";

  const reviews = await prisma.review.findMany({
    where: {
      status,
      ...(params.q ? { body: { contains: params.q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { title: true, slug: true } },
    },
  });

  const counts = await prisma.review.groupBy({ by: ["status"], _count: true });
  const countFor = (entry: string) => counts.find((row) => row.status === entry)?._count ?? 0;

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Everything starts in moderation. Publishing is the decision a person makes."
      />

      <AdminFilters
        searchPlaceholder="Search review text"
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "PENDING", label: `Pending (${countFor("PENDING")})` },
              { value: "PUBLISHED", label: `Published (${countFor("PUBLISHED")})` },
              { value: "REJECTED", label: `Rejected (${countFor("REJECTED")})` },
            ],
          },
        ]}
      />

      <Panel className="mt-4">
        {reviews.length === 0 ? (
          <EmptyState
            title={status === "PENDING" ? "Nothing waiting" : "No reviews here"}
            description={status === "PENDING" ? "The moderation queue is empty." : undefined}
          />
        ) : (
          <ul className="divide-y divide-line">
            {reviews.map((review) => (
              <li key={review.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Rating value={review.rating} showCount={false} />
                      {review.title ? <p className="text-[13.5px] font-medium">{review.title}</p> : null}
                      {review.isVerifiedPurchase ? <Badge tone="success">Verified purchase</Badge> : null}
                    </div>
                    <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-soft">{review.body}</p>
                    <p className="mt-2 text-[11.5px] text-muted">
                      {review.user.name} ({review.user.email}) on{" "}
                      <Link href={`/product/${review.product.slug}`} className="underline underline-offset-2">
                        {review.product.title}
                      </Link>{" "}
                      ·{" "}
                      <time dateTime={review.createdAt.toISOString()}>
                        {review.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
                      </time>
                    </p>
                  </div>

                  <ReviewModeration reviewId={review.id} status={review.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
