# Architecture

## Shape of the system

A single Next.js application serving three surfaces, all backed by one PostgreSQL
database:

```
                    ┌──────────────────────────────────────────┐
  Browser ───────▶  │ Next.js (App Router, React 19)           │
                    │                                          │
                    │  (storefront)/   public shop             │
                    │  (admin)/admin   protected back office   │
                    │  api/            webhooks, auth, health  │
                    └──────────────┬───────────────────────────┘
                                   │  server-only modules
                    ┌──────────────▼───────────────────────────┐
                    │ src/server/**  — business logic           │
                    │  catalog · cart · pricing · checkout      │
                    │  orders · inventory · payments · email    │
                    │  promotions · reviews · search · audit    │
                    └──────────────┬───────────────────────────┘
                                   │  Prisma 7 + pg adapter
                    ┌──────────────▼───────────────────────────┐
                    │ PostgreSQL 16                             │
                    └───────────────────────────────────────────┘
                                   ▲
  Stripe webhooks ─────────────────┘  (signature-verified, idempotent)
```

## Layering rules

1. **Pages and components never talk to Prisma directly.** They call a module in
   `src/server/<domain>`. This is what keeps business rules out of the UI.
2. **`src/server/**` is server-only.** Modules that must never reach the browser
   import `server-only` at the top; a stray client import becomes a build error.
3. **Every mutation is a Server Action or a route handler** that (a) parses input
   with Zod, (b) resolves the actor and checks permission, (c) applies the rule,
   (d) writes an audit entry when it is an administrative action.
4. **Prices, totals, and stock are recomputed server-side on every request.**
   Client-supplied money values are never trusted; the cart API accepts only
   variant ids and quantities.

## Directory map

```
src/
  app/
    (storefront)/            # public store, shared storefront chrome
      page.tsx               # homepage
      shop/ category/[slug]/ brand/[slug]/ search/ product/[slug]/
      cart/ wishlist/ checkout/ order/success/
      account/ (profile, addresses, orders, orders/[id], wishlist)
      about/ contact/ faq/ shipping/ returns/ privacy/ terms/
    (admin)/admin/           # back office; layout enforces staff access
      page.tsx               # dashboard
      products/ categories/ brands/ inventory/ orders/ payments/
      customers/ promotions/ content/ reviews/ settings/ audit/
    api/
      auth/[...all]/         # Better Auth handler
      webhooks/stripe/       # signed payment webhooks
      search/suggest/        # typeahead
      health/                # liveness + DB probe
    sitemap.ts robots.ts     # SEO
  server/
    db.ts                    # Prisma singleton (driver adapter)
    auth/                    # Better Auth config, session helpers, RBAC guards
    catalog/ cart/ pricing/ checkout/ orders/ inventory/ payments/
    promotions/ reviews/ search/ email/ media/ analytics/ audit/
    settings/ notifications/ rate-limit/
    validation/              # Zod schemas shared with forms
    money.ts errors.ts logger.ts
  components/
    ui/                      # design-system primitives
    storefront/ admin/ motion/ three/
  lib/                       # client-safe helpers (formatting, hooks, cn)
  generated/prisma/          # generated client (gitignored)
prisma/  schema.prisma · migrations/ · seed.ts
tests/   unit/ · integration/ · e2e/
docs/
```

## Key flows

### Cart
An anonymous visitor gets a signed, HttpOnly `kiip_cart` cookie holding a random
token; the cart row is keyed by that token. On login the anonymous cart is merged
into the user's cart (quantities summed, capped at available stock) and the token
cart is marked converted. Cart *items* store only `variantId` and `quantity` —
every price shown is derived from the database at render time.

### Checkout and payment
1. `POST` checkout → server revalidates the cart (stock, active variants, prices),
   recomputes subtotal/discount/shipping/tax, and creates an `Order` in
   `PENDING_PAYMENT` **inside a transaction** that also reserves inventory.
2. A `PaymentIntent` is created for the *server-computed* total. The client receives
   only a client secret (Stripe) or a mock reference.
3. The browser confirms payment with the provider directly. The success redirect is
   treated as a hint, never as proof.
4. The signed webhook marks the payment `SUCCEEDED`, moves the order to `PAID`,
   converts reservations into a stock decrement, records a `CouponRedemption`, and
   queues the confirmation email — all idempotently, keyed on the provider event id.

### Inventory
`InventoryItem` holds `onHand` and `reserved`; available stock is the difference.
Reservations and commits run inside `SERIALIZABLE`-safe transactions using
`SELECT ... FOR UPDATE` on the inventory rows, ordered by id to avoid deadlocks.
Database `CHECK` constraints (`on_hand >= 0`, `reserved >= 0`, `reserved <= on_hand`)
mean that even a logic bug cannot produce negative stock. Every change writes an
`InventoryTransaction` row, so stock is fully auditable.

### Order state machine
Transitions are declared in `src/server/orders/state-machine.ts` as an explicit
adjacency map. `assertTransition()` throws on anything not declared, and every
accepted transition writes an `OrderStatusEvent` plus the relevant timestamp column.

## Extensibility

- **New categories** are rows, created in the admin panel; the tree is self-referencing.
- **New product types** are expressed with `AttributeDefinition` rows (typed, optionally
  category-scoped, optionally filterable). A "Toys" product with `ageRange` and a
  "Coffee" product with `roastLevel` need no code change and no migration.
- **New payment providers** implement `PaymentProvider`.
- **A dedicated search engine** implements `SearchEngine`.
