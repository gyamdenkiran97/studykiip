import type { MetadataRoute } from "next";
import { env } from "@/server/env";

/**
 * Robots.
 *
 * Private and transactional areas are disallowed, along with filtered and
 * paginated collection URLs, which multiply into near-duplicate pages without
 * adding anything a crawler needs.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/account",
          "/account/",
          "/cart",
          "/checkout",
          "/checkout/",
          "/order/",
          "/wishlist",
          "/sign-in",
          "/sign-up",
          "/forgot-password",
          "/reset-password",
          "/api/",
          "/search?",
          "/*?brand=",
          "/*?attr_",
          "/*?min=",
          "/*?max=",
          "/*?page=",
          "/*?sort=",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
