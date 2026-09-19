# Kwidus21 — build progress

> Working log for this repository. Read this first when resuming with fresh context,
> then `tests.json`, then `git log --oneline`, then run `npm run test`.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 (strict) · PostgreSQL 16
· Prisma 7 · Tailwind 4 · Better Auth · Stripe behind a provider interface · Vitest ·
Playwright

**Status: feature-complete and verified locally. Not deployed.** Nothing has been
released, no service purchased, no billing configured, no DNS touched. See
`docs/deployment.md` for what a launch would involve and what it needs from the
business first.

## How to run this project locally

```bash
cp .env.example .env          # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm install
npm run db:migrate            # applies prisma/migrations
npm run db:seed               # demo catalog + demo accounts (passwords from .env)
npm run dev                   # http://localhost:3000
```

Tests:

```bash
npm run test                  # 136 unit + integration tests (needs a test database)
npm run test:e2e              # 78 end-to-end tests (starts a dev server if needed)
```

## Documentation

| File | What is in it |
| --- | --- |
| `docs/architecture.md` | System shape, layering, where decisions are made |
| `docs/database.md` | Schema conventions, inventory and order modelling, constraints, migrations |
| `docs/security.md` | Threat model, authn/authz, payment rules, headers, **known gaps** |
| `docs/deployment.md` | Build, configuration, webhooks, pre-launch checklist |
| `docs/admin-guide.md` | Roles, every back-office screen, everyday tasks |
| `docs/design-system.md` | Tokens, type, motion, and the **originality review** |
| `docs/technology-decisions.md` | Every dependency, its version and why |
| `tests.json` | Each requirement mapped to the test file that proves it |

## Milestones

| # | Milestone | Status |
| --- | --- | --- |
| M0 | Research + architecture | ✅ done |
| M1 | Foundation + design system | ✅ done |
| M2 | Database + authentication | ✅ done |
| M3 | Catalog | ✅ done |
| M4 | Storefront | ✅ done |
| M5 | Cart + wishlist | ✅ done |
| M6 | Checkout + payment sandbox | ✅ done |
| M7 | Orders + inventory | ✅ done |
| M8 | Admin panel | ✅ done |
| M9 | Emails + search + reviews | ✅ done |
| M10 | 3D / motion polish | ✅ done |
| M11 | Security / performance / accessibility | ✅ done |
| M12 | End-to-end QA | ✅ done |
| M13 | Production deployment preparation | ✅ documented, not executed |

## Verification — measured, not assumed

Everything below was run on 2026-09-18 against this commit.

**Tests.** 136 Vitest tests across 17 files (unit + integration, the integration
suite against a real PostgreSQL database), and 78 Playwright tests across 9 spec
files. All passing, none skipped. Test counts and per-requirement mapping are in
`tests.json`.

**Build.** `npm run build` succeeds: TypeScript clean, 100 static pages generated,
no warnings.

**Production guards actually fire.** `next start` was booted against the local
configuration and refused twice before it would serve anything — first
`PAYMENT_PROVIDER=mock is not permitted in production`, then, once that was
corrected, `E2E_RELAX_AUTH_RATE_LIMIT cannot be enabled in production`. These are
not warnings: every request returns 500 until the configuration is right. It
served traffic on the third attempt.

**Homepage payload** (production build, measured over HTTP):

| Asset | Size |
| --- | --- |
| HTML | 21.4 KB gzipped (183.7 KB raw, including the RSC payload) |
| JavaScript | 227 KB gzipped across 15 chunks (731 KB raw) |
| CSS | 12.3 KB gzipped |
| Fonts | 97.3 KB, two self-hosted woff2 files |
| TTFB | ~42 ms locally |

The 3D scene is not in that figure — it is dynamically imported and gated, so a
visitor who does not qualify for it never downloads it.

**Accessibility.** axe (WCAG 2.1 and 2.2, A + AA) reports zero violations on eight
storefront pages and the admin dashboard. Keyboard operation of the header and
basket drawer, the announced form error, and reduced-motion rendering are each
asserted separately, because axe cannot see them.

**Responsive.** No horizontal overflow at 360, 390, 393, 430, 768, 1024, 1280,
1440 or 1920 px, asserted in the suite at 393 px and checked by hand at the rest.

**Purchase, by hand in a browser.** Sign in → choose a variant → add to basket →
apply a coupon → checkout → sandbox payment → webhook-confirmed confirmation →
the order showing as PAID in order history. Then all 15 admin screens, an order
detail and an invoice.

## Log

### 2026-09-18 — M0 research + architecture
- Empty repository on branch `claude/elegant-volta-jqn8bx`; Node 22.22, PostgreSQL 16
  available locally (started the service, created `kiipmall` and `kiipmall_test`).
- Checked current stable versions and licences on the npm registry for every candidate
  dependency. Two notable rejections: Prisma 8 (`latest` tag is an RC → pinned 7.10.0)
  and TypeScript 7 (native port, ecosystem not yet validated → stayed on 5.x).
  Rationale in `docs/technology-decisions.md`.
- **The Dribbble reference could not be retrieved — `dribbble.com` is blocked by this
  environment's network egress proxy.** The visual direction is therefore derived from
  the written brief's principles only. See `docs/design-system.md` §1 for the
  originality statement and the check that is outstanding.
- Scaffolded the Next.js app, wrote the full Prisma schema (55 models), applied the
  initial migration.

### M1–M2 — foundation, database, authentication
- Tailwind 4 CSS-first `@theme` tokens; the warm paper/ink palette and the editorial
  type scale.
- Prisma 7 needed `prisma.config.ts` — the datasource URL is no longer allowed in
  `schema.prisma`. Added `@prisma/adapter-pg`.
- Trigram GIN indexes had to be *declared* in the schema (`ops: raw("gin_trgm_ops")`,
  `type: Gin`). Adding them in raw SQL made Prisma see drift and write a migration that
  dropped them again.
- Better Auth with scrypt hashing and the Prisma adapter. The seed calls
  `better-auth/crypto` directly, because importing the server auth module pulls in
  `server-only`, which throws under `tsx`.

### M3–M5 — catalog, storefront, basket
- Products own variants; variants own price and stock. Options and option values make
  the variant matrix data rather than code.
- `AttributeDefinition` / `ProductAttribute` let an admin define a new product type,
  and its filters, without a deployment.
- Category tiles showed 0 products → added `getCategoryProductCounts`, a recursive CTE
  that counts the whole subtree.
- Colourway images were binding to the last variant of a colour → the seed now binds to
  the first, and the product page matches on the shared option value.

### M6–M7 — checkout, payments, orders, inventory
- One transaction places an order: verify basket and address ownership, re-read prices
  from the catalogue, re-validate the coupon, compute the breakdown, snapshot the
  items, reserve stock, convert the basket.
- `SELECT ... FOR UPDATE ORDER BY id` for reservations. The consistent lock order is
  what stops two concurrent checkouts deadlocking; an integration test runs them
  concurrently and asserts the last unit is never sold twice.
- Webhooks write `PaymentEvent` **first**, so a replay hits the unique
  `providerEventId` and stops there.
- Placing an order bounced the customer to `/cart` mid-payment: the basket had been
  converted, and the checkout guard redirected. Fixed by moving payment to its own
  resumable route, `/checkout/payment/[id]`.

### M8–M9 — admin, email, search, reviews
- 15 admin screens plus order detail and a printable invoice. Every action re-checks
  its permission server-side; the layout gate is convenience, not the boundary.
- Search over pg_trgm with an admin-editable synonym table, behind a `SearchEngine`
  interface so a dedicated search service is one adapter away.

### M10–M11 — motion, 3D, security, performance, accessibility
- The scroll reveal never fired: `clip-path: inset(0 0 100% 0)` collapses the rectangle
  `IntersectionObserver` measures. Split the observed element from the animated one.
- The 3D scene fetched an HDR environment map from a CDN — a hard third-party
  dependency for a decorative effect. Replaced with hemisphere and point lights; it now
  makes no network request at all.
- axe reported 130+ contrast violations. Two causes: one real token failure
  (`--color-muted-soft` at 3.24:1) and transient mid-animation opacity. The token was
  darkened to 5.0:1 — the design changed to meet the requirement — and the scans now
  run in a reduced-motion context, which is both the settled state and the rendering a
  motion-sensitive visitor receives.
- `next build` failed on the production env guards. Fixed by skipping them during
  `phase-production-build` only: the machine that compiles is not the machine that
  serves, and the guards still run at boot (verified above).

### M12 — end-to-end QA
- Five E2E failures turned out to be **application** bugs and were fixed in the
  application, not in the tests: a filter checkbox that did not reflect a click, a
  duplicate `aria-hidden` link in the product card, a single-column grid overflowing at
  `max-content`, a price row that could not wrap, and control characters gluing search
  words together.
- Five others were test-quality problems and were fixed in the tests: an ambiguous
  "Sign in" selector, a price selector that also matched rating counts, shared basket
  state between tests, a coupon with a per-user limit, and an admin "first checkbox"
  that was the wrong control.
- Sign-in rate limiting broke the suite with 429s. Rather than weakening the limit,
  the suite signs in once and reuses `storageState`, with `E2E_RELAX_AUTH_RATE_LIMIT`
  for the specs that must sign in repeatedly — refused in production.
- "A review can be moderated" used to skip when the queue was empty. A skipped test
  verifies nothing, so it was rewritten to provision its own subject by rejecting and
  re-publishing a review. Nothing in the suite skips now.
- Two gaps found while auditing `tests.json` against the actual suite, both closed:
  the anonymous-basket merge on sign-in, and hashed password storage, had no tests.
  They now have `tests/integration/cart.test.ts` and
  `tests/integration/auth-credentials.test.ts`.
- The same coupon validity rule was written out inline in two places — the basket and
  the order transaction. Two copies of a rule is how an expired code eventually gets
  honoured at checkout, so it was extracted to `isCouponUsable()` and unit tested,
  boundaries included.

### M12 — code quality pass
- `npm run lint` reported 13 errors and 13 warnings. All were fixed rather than
  suppressed: no rule was disabled and no `eslint-disable` comment was added.
- Seven of the errors were `react-hooks/set-state-in-effect`. Each was a real
  pattern worth changing, not noise:
  - `Reveal` now applies its hidden state to the DOM node instead of holding it
    in React state. Content renders visible — which is what a visitor without
    JavaScript and every crawler sees — and the effect hides it only once it can
    be observed, so every revealed section is one render lighter on mount.
  - The header's menu reset, the gallery's colourway jump and the collection
    filters' URL mirror are adjusted during render instead of in an effect, so
    the new page is never painted for a frame with the old page's state.
  - The search overlay reads recent searches when it opens rather than in an
    effect, and derives the "too short to search" empty list instead of clearing
    it through state.
  - The 3D showcase resolves its device pixel ratio inside the intersection
    callback, which is the moment the canvas actually mounts.
- Six were unescaped apostrophes in JSX, now proper typographic `&rsquo;`.
- The remaining warnings were unused imports and parameters, all removed.
- `npm run lint`, `npm run typecheck`, `npm run build`, 126 Vitest tests and 67
  Playwright tests were all re-run after these changes and all pass.

### 2026-09-19 — rename to Kwidus21, and two bugs it surfaced

The store was renamed from its working title. 40 files: display name, package
name, cookie and storage-key prefixes, the mock provider's signature header,
placeholder email domains, seeded social handles, and the docs. The header
wordmark lost its "Mall" descriptor, which is no longer part of the name. The
local PostgreSQL database keeps its original name — that is environment
configuration, not branding, and `.env.example` ships generic placeholders.
The demo data was re-seeded so the demo accounts use the new domain.

Re-running the suite afterwards turned up **two genuine bugs**, both in refunds,
and both found because a test refused to skip:

- **A second partial refund corrupted the accounting.** `refundOrder` committed
  the provider call, the refund row and the incremented totals, and only then
  asked the state machine to move the order to `PARTIALLY_REFUNDED` — which it
  already was. The machine has no self-transitions, rightly, so it threw; the
  catch block marked the refund `FAILED` while the money had already moved and
  the totals had already been incremented. The status is now resolved and
  proved legal *before* anything leaves the provider, and a status that does not
  change is simply not asked for. Covered by three new integration tests,
  including one asserting a refused refund leaves the totals untouched.
- **The admin UI offered a refund on an order that had never been paid.**
  Refundable was computed as `totalCents - refundedCents`, so an order whose
  payment was declined showed a full refundable balance. The server always
  refused it, so nothing could go wrong with the money — but it is a broken
  affordance. Refundable now requires a captured payment.

Test-quality work in the same pass:

- The admin tests needed a paid order, which only the customer purchase flow
  creates. They were finding one by scanning, so they passed, skipped or failed
  depending on what had run before them and what previous runs had consumed.
  They now build their own through `tests/e2e/fixtures/paid-order.ts`, which
  writes the same rows a real checkout writes. Raw SQL via `pg`, because
  Playwright compiles to CommonJS and the generated Prisma client is ESM-only.
- `playwright.config.ts` now loads `.env`; Next loads it for the app, but the
  test runner is a separate process and the fixture needs `DATABASE_URL`.
- The refund assertions poll with a reload rather than asserting after a single
  one. The success toast appears the moment the action returns, and a reload in
  that same instant can render before the refreshed data arrives — which says
  nothing about whether the refund worked. The database was checked directly to
  confirm the application was right and the test was wrong.
- **Nothing in the suite skips any more.** 129 Vitest and 67 Playwright tests,
  all executed.

### 2026-09-19 — external UI/UX audit

Reviewed the interface against `nextlevelbuilder/ui-ux-pro-max-skill` (MIT),
using its CRITICAL/HIGH web rules as a checklist. `--design-system` was not
used: generating a fresh visual direction would have fought the identity rather
than checked it.

Most of the checklist already passed. Four real gaps, all fixed, detailed in
`docs/design-system.md` §4a:

- **WCAG 2.2 AA 2.5.8** — the mobile gallery dots were 6×6 px buttons. The dot
  stays 6px and the button around it is now 24×24, so nothing looks different.
- **Those dots announced no state** — added `aria-current` and "image 2 of 5".
- **WCAG 2.2 AA 2.4.11** — the 55px sticky header covered a control tabbed to
  near the top of the viewport. Fixed with `scroll-padding`, measured not
  guessed.
- **Validation errors were reported as server errors.** `schema.parse()` throws
  a `ZodError`, which is not an `AppError`, so `toActionError` fell through to
  "Something went wrong. Please try again." A customer with a mistyped postcode
  was told to retry something guaranteed to fail. Zod rejections now become
  per-field messages; the checkout address form shows each beside its input and
  focuses a summary that links to them.

Two findings were consciously declined, with reasons recorded: short product
title links (covered by the inline and equivalent-control exceptions) and the
generated palette/font recommendations (would discard the originality work).

`tests/e2e/target-size.spec.ts` is new and measures every icon-only control,
because axe does not report target size. An earlier draft flagged forty product
titles; a test that cries wolf gets deleted, so it was narrowed to controls with
no visible text, where no exception applies.

### M13 — deployment preparation
- `docs/deployment.md` written: build and run, every variable, the webhook endpoint
  and the exact event list the handler implements, database operations, monitoring,
  rollback, and a pre-launch checklist that separates technical sign-off from business
  and legal sign-off.
- **Nothing was deployed.** No account created, nothing purchased, no DNS, no billing.

## Known gaps, stated plainly

- **No CSRF token.** Protection relies on `SameSite` cookies and Server Actions.
- **No 2FA for staff accounts.** Should be closed before the store handles real money
  at volume.
- **Email verification is not enforced** before purchase.
- **Disputes are not handled.** `charge.dispute.created` would be recorded and ignored;
  chargebacks need a manual process today.
- **`reconcilePendingPayments` is not scheduled.** It is written and tested but nothing
  calls it on a timer, so a dropped webhook currently needs manual reconciliation.
- **The CSP carries two documented compromises** (`'unsafe-inline'` for styles;
  `'unsafe-eval'` for scripts in development). Both are in `docs/security.md` §7.
- **Legal text is a template** and is marked as requiring review. It promises nothing
  the business has not agreed to.
- **The reference design was never seen** (see M0). The originality checklist in
  `docs/design-system.md` §1.3 is outstanding for someone who can open the link.

## Open questions for the product owner
These use documented development placeholders until answered (§46 of the brief):
- Legal entity name, trading address, and support contact details.
- Real payment credentials (Stripe account) and the live webhook endpoint.
- Currency and tax jurisdiction(s) to launch in — currently GBP with a placeholder
  20% standard rate and a 0% reduced rate.
- Real shipping zones, carriers, and rates.
- Legal review of the Terms/Privacy/Shipping/Returns templates before launch.
- Authorisation to deploy, when the answers above are in place.
