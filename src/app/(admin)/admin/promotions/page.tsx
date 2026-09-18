import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/admin/ui";
import { CouponManager } from "@/components/admin/coupon-manager";

export const metadata: Metadata = { title: "Promotions", robots: { index: false, follow: false } };

export default async function PromotionsPage() {
  await requirePermission("promotion:write");

  const [coupons, categories, brands] = await Promise.all([
    prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        restrictions: true,
        _count: { select: { redemptions: true } },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.brand.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Promotions"
        description="Discount codes. Every code is re-validated when the order is created, not only when it is typed in."
      />
      <CouponManager
        categories={categories}
        brands={brands}
        coupons={coupons.map((coupon) => ({
          id: coupon.id,
          code: coupon.code,
          description: coupon.description ?? "",
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minSubtotalCents: coupon.minSubtotalCents,
          maxDiscountCents: coupon.maxDiscountCents,
          usageLimit: coupon.usageLimit,
          usageLimitPerUser: coupon.usageLimitPerUser,
          timesUsed: coupon.timesUsed,
          startsAt: coupon.startsAt?.toISOString() ?? null,
          endsAt: coupon.endsAt?.toISOString() ?? null,
          isActive: coupon.isActive,
          redemptions: coupon._count.redemptions,
          scope: coupon.restrictions[0]?.scope ?? "",
          targetId: coupon.restrictions[0]?.targetId ?? "",
        }))}
      />
    </>
  );
}
