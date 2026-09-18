import Link from "next/link";
import { getCategoryTree } from "@/server/catalog/queries";
import { getCartCount } from "@/server/cart";
import { getWishlistCount } from "@/server/wishlist";
import { getActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { isStaffRole } from "@/server/auth/permissions";
import { HeaderClient } from "./header-client";

/**
 * Header shell (server component): loads the department tree, basket count and
 * signed-in state once per request, then hands them to the interactive client
 * header. Keeping the data fetch here means the mega menu ships no query code
 * to the browser.
 */
export async function Header() {
  const [tree, cartCount, wishlistCount, actor, announcements] = await Promise.all([
    getCategoryTree(),
    getCartCount(),
    getWishlistCount(),
    getActor(),
    prisma.banner.findMany({
      where: { placement: "ANNOUNCEMENT", isActive: true },
      orderBy: { position: "asc" },
      select: { id: true, headline: true, subtext: true, ctaLabel: true, ctaHref: true },
      take: 4,
    }),
  ]);

  return (
    <HeaderClient
      departments={tree.map((department) => ({
        name: department.name,
        slug: department.slug,
        description: department.description,
        imageUrl: department.imageUrl,
        imageAlt: department.imageAlt,
        children: department.children.map((child) => ({ name: child.name, slug: child.slug })),
      }))}
      cartCount={cartCount}
      wishlistCount={wishlistCount}
      announcements={announcements}
      account={
        actor
          ? { name: actor.name, isStaff: isStaffRole(actor.role) }
          : null
      }
    />
  );
}
