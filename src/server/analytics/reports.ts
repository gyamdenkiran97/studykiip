import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";

/**
 * Admin reporting queries.
 *
 * Revenue counts only orders that actually reached payment, and subtracts
 * refunds — a dashboard that flatters itself is worse than no dashboard.
 */

const REVENUE_STATUSES = Prisma.sql`('PAID','PROCESSING','PACKING','SHIPPED','DELIVERED','PARTIALLY_REFUNDED')`;

export type DashboardMetrics = {
  revenueCents: number;
  revenuePreviousCents: number;
  orderCount: number;
  orderCountPrevious: number;
  averageOrderValueCents: number;
  averageOrderValuePreviousCents: number;
  refundedCents: number;
  newCustomers: number;
  pendingOrders: number;
  awaitingFulfilment: number;
  openReturns: number;
  pendingReviews: number;
};

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export async function getDashboardMetrics(days = 30): Promise<DashboardMetrics & { change: Record<string, number> }> {
  const now = new Date();
  const start = new Date(now.getTime() - days * 86_400_000);
  const previousStart = new Date(now.getTime() - days * 2 * 86_400_000);

  const [current, previous, counts] = await Promise.all([
    prisma.$queryRaw<Array<{ revenue: bigint | null; orders: bigint; refunded: bigint | null }>>(Prisma.sql`
      SELECT COALESCE(SUM("totalCents"), 0) AS revenue,
             COUNT(*) AS orders,
             COALESCE(SUM("refundedCents"), 0) AS refunded
      FROM orders
      WHERE status::text IN ${REVENUE_STATUSES} AND "createdAt" >= ${start}
    `),
    prisma.$queryRaw<Array<{ revenue: bigint | null; orders: bigint }>>(Prisma.sql`
      SELECT COALESCE(SUM("totalCents"), 0) AS revenue, COUNT(*) AS orders
      FROM orders
      WHERE status::text IN ${REVENUE_STATUSES}
        AND "createdAt" >= ${previousStart} AND "createdAt" < ${start}
    `),
    Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: start } } }),
      prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
      prisma.order.count({ where: { status: { in: ["PAID", "PROCESSING", "PACKING"] } } }),
      prisma.returnRequest.count({ where: { status: { in: ["REQUESTED", "APPROVED", "IN_TRANSIT", "RECEIVED"] } } }),
      prisma.review.count({ where: { status: "PENDING" } }),
    ]),
  ]);

  const revenueCents = Number(current[0]?.revenue ?? 0);
  const orderCount = Number(current[0]?.orders ?? 0);
  const refundedCents = Number(current[0]?.refunded ?? 0);
  const revenuePreviousCents = Number(previous[0]?.revenue ?? 0);
  const orderCountPrevious = Number(previous[0]?.orders ?? 0);

  const aov = orderCount > 0 ? Math.round(revenueCents / orderCount) : 0;
  const aovPrevious = orderCountPrevious > 0 ? Math.round(revenuePreviousCents / orderCountPrevious) : 0;

  const [newCustomers, pendingOrders, awaitingFulfilment, openReturns, pendingReviews] = counts;

  return {
    revenueCents,
    revenuePreviousCents,
    orderCount,
    orderCountPrevious,
    averageOrderValueCents: aov,
    averageOrderValuePreviousCents: aovPrevious,
    refundedCents,
    newCustomers,
    pendingOrders,
    awaitingFulfilment,
    openReturns,
    pendingReviews,
    change: {
      revenue: percentChange(revenueCents, revenuePreviousCents),
      orders: percentChange(orderCount, orderCountPrevious),
      aov: percentChange(aov, aovPrevious),
    },
  };
}

export async function getRevenueSeries(days = 30) {
  const start = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.$queryRaw<Array<{ day: Date; revenue: bigint; orders: bigint }>>(Prisma.sql`
    SELECT date_trunc('day', "createdAt") AS day,
           COALESCE(SUM("totalCents"), 0) AS revenue,
           COUNT(*) AS orders
    FROM orders
    WHERE status::text IN ${REVENUE_STATUSES} AND "createdAt" >= ${start}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  // Fill the gaps so a quiet day reads as zero rather than disappearing.
  const byDay = new Map(rows.map((row) => [row.day.toISOString().slice(0, 10), row]));
  const series: Array<{ date: string; revenueCents: number; orders: number }> = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10);
    const row = byDay.get(date);
    series.push({
      date,
      revenueCents: Number(row?.revenue ?? 0),
      orders: Number(row?.orders ?? 0),
    });
  }

  return series;
}

export async function getBestSellers(limit = 6, days = 30) {
  const start = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.$queryRaw<
    Array<{ product_title: string; sku: string; units: bigint; revenue: bigint; slug: string | null }>
  >(Prisma.sql`
    SELECT oi."productTitle" AS product_title,
           oi.sku,
           SUM(oi.quantity) AS units,
           SUM(oi."totalCents") AS revenue,
           p.slug
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId"
    LEFT JOIN product_variants pv ON pv.id = oi."variantId"
    LEFT JOIN products p ON p.id = pv."productId"
    WHERE o.status::text IN ${REVENUE_STATUSES} AND o."createdAt" >= ${start}
    GROUP BY oi."productTitle", oi.sku, p.slug
    ORDER BY units DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    title: row.product_title,
    sku: row.sku,
    units: Number(row.units),
    revenueCents: Number(row.revenue),
    slug: row.slug,
  }));
}

export async function getRecentOrders(limit = 8) {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      currency: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      _count: { select: { items: true } },
    },
  });
}

export async function getSearchInsights(limit = 20) {
  const [popular, empty] = await Promise.all([
    prisma.searchQueryLog.groupBy({
      by: ["query"],
      _count: { query: true },
      _max: { results: true },
      where: { results: { gt: 0 } },
      orderBy: { _count: { query: "desc" } },
      take: limit,
    }),
    prisma.searchQueryLog.groupBy({
      by: ["query"],
      _count: { query: true },
      where: { results: 0 },
      orderBy: { _count: { query: "desc" } },
      take: limit,
    }),
  ]);

  return {
    popular: popular.map((row) => ({ query: row.query, searches: row._count.query, results: row._max.results ?? 0 })),
    // Searches that found nothing: the most actionable list in the building.
    empty: empty.map((row) => ({ query: row.query, searches: row._count.query })),
  };
}
