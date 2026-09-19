# Database

PostgreSQL 16, accessed through Prisma 7 with the `@prisma/adapter-pg` driver
adapter. The schema lives in `prisma/schema.prisma`; the generated client is
written to `src/generated/prisma` and is imported everywhere as
`@/generated/prisma/client`.

Connection settings are **not** in the schema. Prisma 7 moved the datasource URL
out of `schema.prisma`, so `prisma.config.ts` reads `DATABASE_URL` and builds the
adapter. The schema file therefore contains no credentials of any kind.

---

## 1. Conventions

These hold for every table, and breaking one should be treated as a bug.

**Money is never a float.** Every monetary column is an `Int` of minor units
(cents, pence, won) paired with an ISO-4217 `@db.Char(3)` currency column. There
is no `Decimal`, `Float` or `Money` column anywhere in the schema. Rounding and
allocation happen once, in `src/lib/money.ts`, and `sumCents` throws a
`TypeError` if a non-integer ever reaches it.

**Rates are basis points.** `TaxClass.rateBps`, and `Coupon.discountValue` when
`discountType` is `PERCENTAGE`, store hundredths of a percent as integers:
`2000` is 20.00%. This keeps tax arithmetic exact and avoids `0.2 * 3` problems.
A `FIXED_AMOUNT` coupon reuses the same column for minor units, which is
documented on the field and asserted by the pricing tests.

**Identifiers are `cuid()` strings.** Sequential integer ids leak order volume
and customer counts to anyone who can read a URL, so they are not used for
anything user-facing.

**Table names are snake_case plural** via `@@map`; model names stay singular
PascalCase. Column names are left camelCase and therefore quoted in raw SQL
(`p."deletedAt"`), which is the trade-off for not maintaining a second naming
map by hand.

**Deletion is soft where history matters.** `Product`, `ProductVariant`,
`Category`, `Brand` and `User` carry `deletedAt`. Orders reference variants with
`onDelete: SetNull` and keep their own snapshot, so removing a product never
rewrites what somebody bought. Join rows and genuinely disposable records
(`CartItem`, `RecentlyViewed`) cascade.

**Every table carries `createdAt`**, and anything mutable also carries
`updatedAt`.

---

## 2. Domain map

55 models in ten groups.

| Group | Models |
| --- | --- |
| Identity | `User`, `Session`, `Account`, `Verification`, `Permission`, `UserPermission`, `Address` |
| Catalog | `Category`, `Brand`, `Product`, `ProductCategory`, `ProductRelation`, `ProductOption`, `ProductOptionValue`, `ProductVariant`, `VariantOptionValue`, `ProductMedia`, `TaxClass` |
| Extensibility | `AttributeDefinition`, `ProductAttribute` |
| Inventory | `Warehouse`, `InventoryItem`, `InventoryTransaction` |
| Shopping | `Cart`, `CartItem`, `Wishlist`, `WishlistItem`, `RecentlyViewed` |
| Pricing | `Coupon`, `CouponRestriction`, `CouponRedemption`, `Promotion`, `ShippingZone`, `ShippingMethod`, `TaxConfiguration` |
| Orders | `Order`, `OrderItem`, `OrderStatusEvent`, `Shipment`, `TrackingEvent`, `ReturnRequest`, `ReturnRequestItem` |
| Payments | `Payment`, `PaymentEvent`, `Refund` |
| Content | `SiteSetting`, `HomepageSection`, `Banner`, `NavigationMenu`, `NavigationItem`, `Review`, `ReviewMedia` |
| Operations | `SearchSynonym`, `SearchQueryLog`, `Notification`, `AuditLog`, `RateLimitCounter`, `EmailLog` |

---

## 3. Catalog shape

### Categories are a tree

`Category.parentId` is a self-relation (`CategoryTree`) with `onDelete: SetNull`,
so deleting a parent promotes its children rather than destroying a branch.
Depth is not fixed in the schema — the storefront renders two levels in the
navigation and walks the full tree elsewhere. Product counts for a department
come from a recursive CTE (`getCategoryProductCounts`) so a top-level tile counts
everything beneath it, not just products attached directly to it.

`ProductCategory` is a many-to-many join, because a raincoat legitimately belongs
in both *Outerwear* and *Sports*.

### Products own variants; variants own price and stock

A `Product` is the marketing object: title, description, media, brand, tags, SEO
fields. A `ProductVariant` is the thing that is actually sold, and it is the only
place a price or a stock level exists. This is what makes multi-category work: a
T-shirt varies by size and colour, a laptop by RAM and storage, a sofa by fabric,
and all three are the same three tables.

Variants are described by options, not by hard-coded columns:

```
ProductOption      (Product → "Colour", position 0)
ProductOptionValue (Colour → "Storm", "Fern", "Chalk")
ProductVariant     (SKU, price, currency, weight, dimensions)
VariantOptionValue (Variant ↔ OptionValue, composite PK)
```

The buy box reads `VariantOptionValue` to build its matrix and to grey out
combinations that do not exist. Adding a third axis to a product needs a row, not
a migration.

`ProductVariant.salePriceCents` is nullable and is only honoured by pricing when
it is present, positive and strictly lower than `priceCents` — a stale sale price
above the regular price cannot raise what a customer pays.

### New product types without code changes

`AttributeDefinition` is an admin-defined attribute schema — key, label, type
(`TEXT` / `NUMBER` / `BOOLEAN` / `SELECT`), optional unit, optional `options`
list, optional `categoryId` scope and an `isFilterable` flag.
`ProductAttribute` holds the values, unique per `(productId, definitionId)` and
indexed on `(definitionId, value)` so filtering by "Screen size = 14 inch" stays
a normal index scan.

An admin who needs to sell mattresses defines *Firmness* and *Depth* in the back
office, and the collection page grows those filters with no deployment. The cost
of that flexibility is that values are stored as text and validated against
`AttributeDefinition.type` in the application layer rather than by the column
type; that is the deliberate trade for not requiring a migration per category.

---

## 4. Inventory

`InventoryItem` is unique on `(variantId, warehouseId)` and holds two counters:

- `onHand` — units physically in the warehouse.
- `reserved` — units promised to orders that are in flight.

**Available stock is `onHand - reserved`**, computed nowhere else. Placing an
order raises `reserved`; fulfilment lowers both `onHand` and `reserved`;
cancellation lowers `reserved` alone.

Reservation is transactional. `reserveStock` locks the relevant rows with
`SELECT ... FOR UPDATE` **ordered by id** — a consistent lock order is what
prevents two concurrent checkouts from deadlocking each other — re-reads the
counters inside the lock, and raises `outOfStock` with per-line shortfalls if the
demand cannot be met. A quantity arriving from the browser is only ever a
request; the number that decides the outcome is the one read inside that
transaction. An integration test runs concurrent reservations against a real
Postgres instance and asserts that the sum never exceeds `onHand`.

`Order.inventoryCommitted` and `Order.inventoryReleased` make commit and release
idempotent, so a replayed webhook or a double-clicked admin button cannot
decrement stock twice.

`InventoryTransaction` is the ledger: signed `onHandDelta` and `reservedDelta`, a
typed `reason` (`RESTOCK`, `SALE`, `RESERVATION`, `RELEASE`, `RETURN`, `DAMAGE`,
`CORRECTION`, `INITIAL`), and optional `orderId` / `actorId`. Counters can always
be reconciled against the sum of their transactions.

A CHECK constraint keeps `onHand` and `reserved` non-negative. The schema
deliberately does **not** enforce `reserved <= onHand`, because
`ProductVariant.allowBackorder` is a supported configuration.

---

## 5. Orders

`Order` stores its own money columns (`subtotalCents`, `discountCents`,
`shippingCents`, `taxCents`, `totalCents`, `refundedCents`) and `OrderItem`
snapshots `productTitle`, `variantTitle`, `sku`, `imageUrl`, `brandName` and
`unitPriceCents`. Renaming a product or changing its price next week does not
alter last week's invoice. `OrderItem.variantId` is `SetNull`, so an archived
variant leaves the order readable.

Status is an enum with an explicit transition map in
`src/server/orders/state-machine.ts`. The database stores the status; the state
machine decides which moves are legal, and `assertTransition` refuses anything
not in the adjacency map. Each status has a matching timestamp column
(`paidAt`, `shippedAt`, `cancelledAt`, …) and every move writes an
`OrderStatusEvent` with `from`, `to`, `note` and `actorId`, which is what the
customer-facing tracking timeline and the admin audit trail both read.

Order numbers are human-facing and separate from the id (`orderNumber @unique`).

---

## 6. Payments

`Payment.providerRef` is unique — one payment row per provider intent.
`PaymentEvent.providerEventId` is unique, and the webhook handler inserts that
row **before** doing any work. A replayed delivery therefore hits a unique
violation and is discarded, which is the whole idempotency mechanism.

No card data is stored. The columns are `methodBrand` and `methodLast4`, both
supplied by the provider, plus `failureCode` / `failureMessage`. There is no
column that could hold a PAN, a CVV or a client secret.

`Refund` rows carry their own status and amount; `Order.refundedCents` and
`Payment.refundedCents` are running totals, and CHECK constraints keep every
money column non-negative.

---

## 7. Constraints and indexes

### CHECK constraints

`prisma/migrations/20260918151500_constraints/migration.sql` adds what Prisma
cannot express:

- inventory `onHand >= 0` and `reserved >= 0`
- `ProductVariant.priceCents >= 0`; `costPriceCents` null or `>= 0`;
  `salePriceCents` null or `>= 0 AND < priceCents` — a sale price can never be
  at or above the regular price
- `CartItem.quantity > 0`, `OrderItem.quantity > 0`, and
  `0 <= refundedQuantity <= quantity`
- every order money column `>= 0`, and `refundedCents <= totalCents`
- `Payment.amountCents > 0` and `0 <= refundedCents <= amountCents`
- `Refund.amountCents > 0`
- `Review.rating BETWEEN 1 AND 5`
- `Coupon.discountValue >= 0`, and `<= 10000` when `discountType` is
  `PERCENTAGE` (100%)
- coupon `startsAt < endsAt` when both are set

Application code enforces these too. Both layers are intentional: validation
gives a good error message, the constraint guarantees the invariant against a
bug, a migration or a hand-written SQL fix.

### Search indexes

`pg_trgm` is enabled through the `postgresqlExtensions` preview feature and
declared on the datasource, so the extension is created by migration rather than
by hand. Trigram GIN indexes are declared in the schema itself:

```prisma
@@index([title(ops: raw("gin_trgm_ops"))], type: Gin, name: "products_title_trgm_idx")
```

Declaring them (rather than adding them in raw SQL) matters: an index Prisma does
not know about shows up as drift, and the next `prisma migrate dev` writes a
migration that drops it.

### Hot-path indexes

`Order(userId, createdAt)` for order history, `Order(status)` for the admin
queue, `InventoryItem(variantId)` for stock lookups,
`ProductAttribute(definitionId, value)` for faceted filters,
`OrderStatusEvent(orderId, createdAt)` and `PaymentEvent(paymentId, createdAt)`
for timelines, plus unique indexes on every slug, SKU, order number and provider
reference. `orders_status_created_idx` — `(status, "createdAt" DESC)` — is
created in the constraints migration rather than the schema, because the schema
language cannot express a descending sort key on a mapped table.

---

## 8. Migrations

Three migrations, applied in order:

| Migration | Contents |
| --- | --- |
| `20260918150818_init` | all tables, enums, relations, standard indexes |
| `20260918151500_constraints` | `CREATE EXTENSION pg_trgm`, CHECK constraints |
| `20260918151944_search_indexes` | trigram GIN indexes |

Local development uses `npm run db:migrate` (`prisma migrate dev`). Deployments
use `npm run db:deploy` (`prisma migrate deploy`), which only applies pending
migrations and never resets.

`npm run db:reset` is destructive and is scripted but never run automatically.

---

## 9. Seed data

`prisma/seed.ts` (`npm run db:seed`) creates the department tree, brands,
attribute definitions, products with real variant matrices, inventory, shipping
zones and methods, tax classes, coupons, homepage content, search synonyms and a
small set of accounts.

Two things about it are deliberate:

- **Passwords are hashed, not planted.** The seed calls `better-auth/crypto`
  directly (importing the server auth module pulls in `server-only`, which throws
  under `tsx`). There are no hard-coded credentials in application code; the seed
  accounts read their passwords from the environment and exist only for local
  development.
- **Product names, copy and imagery are original or openly licensed.** No brand
  names, product descriptions or photography were copied from a real retailer.
  Where a licensed photograph was not available the seed uses a neutral generated
  placeholder rather than an image of unclear provenance.

---

## 10. Test database

Integration tests run against a **real** PostgreSQL database
(`kiipmall_test`), not a mock and not SQLite. Row locking, CHECK constraints,
`ON DELETE` behaviour and trigram search are precisely the things that would be
faked away by a mock, and they are precisely what these tests exist to verify.
`tests/setup.ts` repoints `DATABASE_URL`, and `tests/integration/helpers/`
truncates and re-seeds between suites.
