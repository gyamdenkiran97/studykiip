# Technology decisions

Every dependency below was checked against the npm registry on 2026-09-18 for its
current stable version, licence, and release cadence before being added. Versions
are pinned in `package.json`; this document records *why*.

## Framework and language

| Choice | Version | Why |
| --- | --- | --- |
| Next.js (App Router) | 16.3.5 | Server Components let catalog pages render on the server with zero client JS for the bulk of the page, which is what makes an image-heavy store fast. Server Actions give us mutations without hand-written API plumbing, while still being server-side (so pricing and authorisation cannot be tampered with from the browser). Route handlers cover the webhook surface. |
| React | 19.2.8 | Version shipped and tested with Next 16. |
| TypeScript | 5.9.x (`^5`) | **Deliberately not 7.0.2.** TypeScript 7 is the native (Go) compiler port and is very new; `eslint-config-next@16.3.5`, `typescript-eslint`, and the Prisma 7 generated client are all validated against the 5.x line today. The gain from TS 7 is compile speed, which is not a bottleneck here, and the risk is tooling breakage. Revisit once `eslint-config-next` declares TS 7 support. |
| Tailwind CSS | 4.x | CSS-first configuration (`@theme`) means our design tokens live in one CSS file and are usable from both Tailwind utilities and hand-written CSS. No `tailwind.config.js` indirection. |

## Data

| Choice | Version | Why |
| --- | --- | --- |
| PostgreSQL | 16 | Transactional guarantees are non-negotiable for inventory and orders. We rely on `SELECT ... FOR UPDATE` row locks and `CHECK` constraints to make overselling structurally impossible, plus `GIN`/`pg_trgm` indexes for search. |
| Prisma ORM | 7.10.0 | **Not 8.0.0** — the `latest` dist-tag currently points at `8.0.0-rc.15`, a release candidate. 7.10.0 is the newest stable. Prisma gives us a typed schema, generated migrations, and interactive transactions. |
| `@prisma/adapter-pg` + `pg` | current | Prisma 7 removed the Rust query engine in favour of driver adapters, so the Postgres driver is now explicit. This also means the connection can be pooled by the platform. |

Money is stored as **integer minor units** (`Int` cents) plus an ISO-4217 currency
code. No `Float`, no `Decimal` rounding surprises. Percentages (tax, discounts,
ratings) are stored in **basis points** for the same reason.

## Authentication

| Choice | Version | Why |
| --- | --- | --- |
| Better Auth | 1.7.5 | Framework-native session handling for Next's App Router, a first-class Prisma adapter, scrypt password hashing, email verification and reset flows, and secure cookie defaults (HttpOnly, SameSite=Lax, Secure in production) out of the box. We do **not** write our own crypto or session logic. |

NextAuth/Auth.js was considered; its stable line (4.x, ISC) predates the App Router
patterns we use, and the v5 line is still beta. Better Auth also lets us add typed
custom fields (`role`, `status`) to the user model without a parallel table.

## Payments

| Choice | Version | Why |
| --- | --- | --- |
| Stripe | 22.6.2 (node) / 9.16.0 (`@stripe/stripe-js`) | PCI-compliant hosted payment elements: raw card data never touches our servers. Payment Intents give us a server-authoritative amount and a signed webhook for confirmation. |

Payments sit behind a `PaymentProvider` interface (`src/server/payments/provider.ts`)
with two implementations: `stripe` and `mock`. The mock provider is what CI and local
development use — it produces deterministic intents and signed webhook payloads so the
entire purchase flow is testable without network access or real credentials. Swapping
in another PSP means writing one adapter, not touching checkout.

## UI, motion, 3D

| Choice | Version | Why |
| --- | --- | --- |
| Radix UI primitives | current | Unstyled, accessible dialog/menu/select/etc. with correct focus trapping and ARIA wiring. We style them ourselves, so nothing looks like a default component library. |
| `motion` (Framer Motion's successor package) | 13.4.0 | Small, hardware-accelerated transforms, and a `useReducedMotion` hook we honour globally. GSAP was not added — nothing in the brief needs a timeline engine that `motion` cannot express, and it is an extra ~70 KB plus a commercial licence question. |
| Three.js + React Three Fiber + drei | 0.186.0 / 9.7.0 / 10.7.8 | Used for exactly one optional homepage showcase, dynamically imported, behind an intersection observer, with a static image fallback and a reduced-motion/low-power bail-out. |
| `lucide-react` | current | One consistent, geometrically coherent icon set. Tree-shaken per icon. |
| `sonner` | 2.0.8 | Accessible toast notifications with an ARIA live region. |

## Validation, email, infrastructure

| Choice | Version | Why |
| --- | --- | --- |
| Zod | 4.6.5 | Every server action and route handler parses its input with a Zod schema before touching the database. Schemas live in `src/server/validation` and are shared with client forms. |
| Resend | 6.28.1 | Simple transactional email API. Behind an `EmailTransport` interface with a logging transport used when no API key is present, so development never sends real mail. |
| Rate limiting | in-house | A `RateLimiter` interface with an in-process store (dev/tests) and an Upstash Redis REST store (production, no extra dependency — plain `fetch`). Avoids adding a Redis client for what is a handful of atomic counters. |

## Testing

| Choice | Version | Why |
| --- | --- | --- |
| Vitest | 5.0.1 | Fast, ESM-native, same transform pipeline as the app. Runs unit tests (pure logic) and integration tests (real Postgres, real Prisma). |
| Playwright | 1.63.0 | Real-browser E2E across desktop/tablet/mobile viewports, with tracing and screenshots for QA evidence. |

## Explicitly rejected

- **A headless commerce SaaS** (Medusa, Saleor, Shopify): the brief asks us to build the
  commerce engine, including admin-defined categories and attributes.
- **Elasticsearch/Meilisearch/Algolia now**: Postgres full-text plus trigram similarity
  is genuinely good enough at this catalog size and adds no infrastructure. Search is
  isolated behind `SearchEngine` (`src/server/search/engine.ts`) so a dedicated engine
  can be dropped in later without touching any page.
- **A state-management library**: server state lives on the server; the small amount of
  client state (cart drawer open, filters) is URL state or React context.
