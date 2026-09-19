# Administrator guide

The back office lives at `/admin`. It is part of the same deployment as the
storefront but is a separate route group with its own layout, navigation and
access rules. Nothing under `/admin` is reachable without a staff role, and no
`/admin` action succeeds without a server-side permission check — hiding a button
is a courtesy to the user, never the control.

---

## 1. Getting in

Sign in through the ordinary `/sign-in` form with a staff account. Accounts are
not special-cased: a staff member is a `User` whose `role` is something other
than `CUSTOMER`. There are no hard-coded administrator credentials anywhere in
the codebase, and there is no back door.

A signed-out visitor is sent to `/sign-in?next=/admin`. A signed-in account
without `admin:access` is redirected to the storefront home page rather than
shown an "insufficient permissions" screen — someone probing `/admin` learns
nothing about what is behind it.

The first staff account comes from the seed (`npm run db:seed`), which reads
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from the environment. That account
is for local development. Delete it before a production launch and create real
accounts.

---

## 2. Roles

Five roles, each a superset of the one before it.

| Role | Intended for | Can |
| --- | --- | --- |
| `CUSTOMER` | shoppers | nothing in `/admin` |
| `STAFF` | support desk | read products, inventory, orders, customers, payments |
| `MANAGER` | day-to-day operations | everything Staff can, plus edit products, categories, brands, inventory and content; progress and cancel orders; run promotions; moderate reviews |
| `ADMIN` | store owner | everything Manager can, plus delete products, issue refunds, change settings, read the audit log |
| `SUPER_ADMIN` | technical owner | everything, plus change other people's roles |

Two rules worth stating plainly:

- **Refunds are `ADMIN`.** Moving money out is deliberately a higher bar than
  moving an order forward.
- **Only `SUPER_ADMIN` can change roles.** A Manager cannot promote themselves.

Give people the narrowest role that lets them do their job. A support agent who
only needs to look things up should be `STAFF`.

### Individual grants

A single permission can be granted to one person without moving them up a whole
role, through the `UserPermission` table. `hasPermission()` checks the role's
baseline first and then those extra grants. Use it for genuine exceptions — a
Staff member who also moderates reviews — not as a way around role design.

---

## 3. The screens

**Dashboard** (`/admin`) — revenue, order counts, low-stock warnings, recent
orders and pending reviews. Read-only.

**Products** (`/admin/products`) — list, search and filter the catalog.
`/admin/products/new` and `/admin/products/[id]` handle creation and editing:
descriptions, media, brand, tax class, categories, tags, SEO fields, options and
the variant matrix. Price and stock live on variants, never on the product.
Publishing is `status`: `DRAFT` is invisible to customers, `ACTIVE` is live,
`ARCHIVED` is retired but still readable on old orders.

**Categories** (`/admin/categories`) — the department tree. Create, rename,
re-parent and reorder. Deleting a parent promotes its children rather than
deleting a branch. This is also where a brand-new department is created: adding
one needs no deployment.

**Brands** (`/admin/brands`) — brand records, logos and SEO fields.

**Inventory** (`/admin/inventory`) — stock per variant per warehouse, showing
`onHand`, `reserved` and available. Adjustments are made here with a reason, and
every adjustment writes an `InventoryTransaction`, so the counter can always be
explained. Low-stock thresholds are per variant.

**Orders** (`/admin/orders`) — the queue, filterable by status.
`/admin/orders/[id]` shows the full order: items as they were bought, addresses,
payments, refunds, shipments and the status timeline. Status changes are made
here; the state machine refuses anything invalid, so the UI simply will not offer
a move that is not allowed. `/admin/orders/[id]/invoice` renders a printable
invoice.

**Payments** (`/admin/payments`) — payment records with their provider status,
plus refunds. Refunds require `refund:write` (Admin) and go through the payment
provider; the order's `refundedCents` and status follow from the result, not from
the button press.

**Customers** (`/admin/customers`) — customer list and `/admin/customers/[id]`
detail: order history, addresses, lifetime value. Role changes appear here and
are only actionable for a `SUPER_ADMIN`.

**Promotions** (`/admin/promotions`) — coupons and campaigns. Percentage,
fixed-amount and free-shipping discounts; minimum subtotal; maximum discount;
total and per-customer usage limits; validity window; restriction to specific
products, categories or brands.

**Reviews** (`/admin/reviews`) — the moderation queue. Approve or reject; only
approved reviews appear on a product page and count towards its rating.

**Content** (`/admin/content`) — homepage sections, banners and navigation menus,
so merchandising changes do not need a deployment.

**Search** (`/admin/search`) — synonyms (so "trainers" finds "sneakers") and the
query log, including searches that returned nothing. The zero-result list is the
most useful page here: it is a list of things customers wanted and could not
find.

**Settings** (`/admin/settings`) — store-wide settings, shipping zones and
methods, tax classes. `ADMIN` only.

**Audit** (`/admin/audit`) — who did what, when, to which record. `ADMIN` only.
Not editable from the UI by anyone.

---

## 4. Everyday tasks

### Add a new department and start selling in it

1. **Categories** → create the department, optionally under a parent.
2. If the new products need attributes the store does not have yet (say
   *Firmness* for mattresses), define them as attribute definitions scoped to
   that category and mark the ones customers should filter by.
3. **Products** → create a product, assign it to the department, add its options
   (Size, Colour, Capacity — whatever applies) and generate variants.
4. Set prices and SKUs per variant, add media, fill in the SEO fields.
5. **Inventory** → set opening stock for each variant.
6. Set the product to `ACTIVE`.

No code change, no deployment, no migration. That is the point of the
attribute-definition model.

### Fulfil an order

Open the order, then walk it forward: `PAID` → `PROCESSING` → `PACKING` →
`SHIPPED` → `DELIVERED`. Marking it shipped is where tracking details are added,
and it is what sends the dispatch email. The state machine will not let the order
skip backwards or jump to a status that does not follow.

### Cancel an order

Cancel from the order detail screen. Reserved stock is released automatically and
exactly once — `inventoryReleased` guards against a double release from a
double-click or a replayed action. Cancelling a paid order does not refund it;
issue the refund separately from **Payments**, so the money and the fulfilment
decisions stay distinct and both get recorded.

### Handle a return

The customer raises a return from their order history, which creates a
`ReturnRequest`. Approve or reject it on the order, and when the goods arrive
restock them through **Inventory** with reason `RETURN` and refund from
**Payments**. Each of those three steps leaves its own record.

### Run a discount

**Promotions** → new coupon. Set the code, the type and value, and — this matters
— a usage limit and an end date. A coupon with neither is a coupon that will
still be working in two years. Every redemption is recorded against the customer
and the order, so per-customer limits are enforced server-side at checkout, not
in the browser.

---

## 5. Things the interface will not let you do

These are not bugs.

- **Set stock to a negative number.** A database CHECK constraint refuses it.
- **Move an order to an invalid status.** The transition map decides, not the UI.
- **Refund more than was paid.** Constrained at both the application and database
  layers.
- **Edit an order's historical prices.** Order items are immutable snapshots.
  Changing a product's price today does not rewrite last month's invoice.
- **Change your own role.** Only a `SUPER_ADMIN` can change roles, including
  their own, and it is written to the audit log.
- **Delete the audit log.** There is no such action.

---

## 6. Security expectations for staff

- Use a unique, long password. Authentication is rate-limited, but a password
  reused from a breached site is still a password someone else has.
- Sign out of shared machines. Sessions are stored server-side and can be
  revoked, but only if someone knows to revoke them.
- Everything you do in `/admin` is attributed to you in the audit log.
- Nobody, including this application, will ever ask you for a customer's payment
  details. Card data is never stored — only the brand and last four digits the
  provider returns.

There is currently **no two-factor authentication for staff accounts**. This is a
known gap, recorded in `docs/security.md`, and it should be closed before the
store handles real money at volume.
