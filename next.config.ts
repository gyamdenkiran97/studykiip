import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The CSP is intentionally strict on what can execute and where data can be
 * sent. Two compromises are documented rather than hidden:
 *
 *   - `'unsafe-inline'` for styles: Tailwind and React inline the critical CSS
 *     and style attributes. Removing it needs a nonce-based style pipeline,
 *     which is a larger change than it sounds and gains little, since injected
 *     CSS cannot execute.
 *   - `'unsafe-eval'` in development only: the dev server's hot reloading needs
 *     it. Production gets neither it nor inline script.
 */
const isProduction = process.env.NODE_ENV === "production";

const scriptSrc = isProduction
  ? "'self' 'unsafe-inline' https://js.stripe.com"
  : "'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self'",
  // Stripe's hosted elements render in an iframe from these origins.
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "connect-src 'self' https://api.stripe.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Clickjacking protection for browsers that do not honour frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  images: {
    formats: ["image/avif", "image/webp"],
    // Uploaded production media lives in object storage; add its host here.
    remotePatterns: [],
  },

  experimental: {
    // Server Actions are same-origin only; this is belt and braces with the CSP.
    serverActions: { allowedOrigins: ["localhost:3000"] },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Generated demo media is immutable and content-addressed by slug.
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
