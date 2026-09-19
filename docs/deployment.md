# Deployment

> **Nothing in this repository has been deployed.** No hosting account has been
> created, no service purchased, no DNS record touched, no billing configured
> and no production database provisioned. This document describes how to do
> those things; performing them needs an explicit go-ahead, and the credentials
> in §3 have to come from the business.

---

## 1. What is being deployed

A single Next.js 16 application (App Router, Node runtime) plus a PostgreSQL
database. There is no separate API service, no queue worker and no separate
admin app — `/admin` is routes inside the same deployment, protected server-side.

Requirements:

| Component | Requirement |
| --- | --- |
| Node.js | 22 LTS (the version this was built and tested on) |
| PostgreSQL | 16, with the `pg_trgm` extension installable |
| Object storage | Optional, S3-compatible, only for admin media uploads |
| Redis | Optional, only to share rate-limit counters across instances |
| TLS | Required — sessions are cookie-based and HSTS is sent |

The app is stateless apart from the database. Sessions live in Postgres, not in
memory, so horizontal scaling works without sticky sessions. The one caveat is
rate limiting: without `UPSTASH_REDIS_REST_*` the limiter is per-process, so N
instances means N times the configured allowance. Configure Redis before running
more than one instance.

---

## 2. Build and run

```bash
npm ci                    # exact lockfile install
npm run db:deploy         # prisma migrate deploy — applies pending migrations only
npm run build             # prisma generate && next build
npm start                 # next start
```

`npm run build` does not need production credentials. Environment validation
skips its production guards while `NEXT_PHASE=phase-production-build`, because
the machine that compiles the app is not the machine that serves traffic. The
same guards run for real when the server boots — which is the moment that
matters, and the moment a misconfiguration should stop the process.

Never run `npm run db:reset` against anything but a local database. It drops
everything.

Seeding (`npm run db:seed`) creates demo catalog data and demo accounts. It is
for development and staging. Do not run it against production.

---

## 3. Configuration

Every variable, with its purpose, is in `.env.example`. Copy it, fill it in, and
keep the filled copy out of the repository — `.env` is in `.gitignore` and must
stay there. Use the host's secret manager rather than a file on disk wherever
that is an option.

`src/server/env.ts` parses the environment through Zod at module load, so a
missing or malformed value fails at boot with a readable message instead of
failing at checkout three hours later.

### Required in production

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Pooled connection for the app |
| `DIRECT_DATABASE_URL` | Unpooled connection for migrations, if behind a pooler |
| `BETTER_AUTH_SECRET` | ≥32 chars. `openssl rand -base64 32`. Rotating it invalidates every session |
| `BETTER_AUTH_URL` | Public origin, `https://` |
| `NEXT_PUBLIC_APP_URL` | Same origin; used for canonicals, sitemap and emails |
| `PAYMENT_PROVIDER` | Must be `stripe`. The app refuses to boot with `mock` in production |
| `STRIPE_SECRET_KEY` | Live secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the endpoint registered in §4 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Live publishable key |
| `RESEND_API_KEY` | Blank means order emails are logged, not sent |
| `EMAIL_FROM` | Must be a verified sender on the email provider |

Enforced refusals: `PAYMENT_PROVIDER=mock` and `E2E_RELAX_AUTH_RATE_LIMIT=true`
both throw at boot when `NODE_ENV=production`. These are not warnings — the
process will not start.

### Credentials that must come from the business

These cannot be invented, and none of them exist yet:

- Live Stripe account, keys and webhook signing secret
- Verified sending domain and email-provider API key
- Production database credentials
- The real trading name, company registration and support contact for the legal
  and contact pages
- The currency and tax jurisdiction the store actually trades in
- Real shipping zones, rates and delivery estimates

---

## 4. Payments

1. Create the webhook endpoint in the Stripe dashboard, pointing at
   `https://<your-domain>/api/webhooks/stripe`.
2. Subscribe to exactly the events the handler implements:
   `payment_intent.succeeded`, `checkout.session.completed`,
   `payment_intent.payment_failed`, `payment_intent.canceled` and
   `charge.refunded`. Any other event type is recorded and ignored.
   Disputes are **not** handled — `charge.dispute.created` would be logged and
   dropped, so chargebacks currently need a manual process.
3. Put the endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`.

The webhook route is the **only** thing that marks an order paid. A browser
arriving at the success URL changes nothing — it renders a page that reads the
order's real status. If the webhook has not arrived yet the confirmation page
says the payment is still being confirmed. Do not "fix" this by trusting the
redirect.

Signature verification is mandatory and a failed signature returns 400 without
touching the order. Replays are absorbed by the unique `providerEventId` on
`PaymentEvent`, which is written before any work is done.

**Post-deploy verification, in Stripe test mode before going live:** place an
order, confirm the webhook fires and the order flips to `PAID`; then force a
declined card and confirm the order stays `PENDING_PAYMENT` and remains payable
from `/checkout/payment/[id]`; then issue a partial refund and confirm
`refundedCents` and the order status follow.

---

## 5. Database operations

Migrations run with `prisma migrate deploy`, which applies pending migrations and
nothing else. Run it before the new application version starts serving, as a
release step.

The three migrations are additive. `20260918151500_constraints` runs
`CREATE EXTENSION IF NOT EXISTS pg_trgm`, which needs a role permitted to create
extensions; on managed Postgres this is usually the default owner, but on some
providers the extension must be enabled from a dashboard first. If that call
fails, the trigram indexes in the following migration will fail too.

Back up before every release, and verify that a restore actually works — an
untested backup is not a backup. Orders, payments and inventory transactions are
the records that cannot be reconstructed.

---

## 6. Scheduled work

One job exists and **is not yet wired to a scheduler**:

`reconcilePendingPayments()` in `src/server/payments/service.ts` re-checks
payments still marked `PROCESSING` against the provider and catches webhooks
that were never delivered. It is written, exported and covered by tests, but
nothing calls it on a timer. Before going live, expose it behind an
authenticated internal route or a scheduled task and run it every few minutes.
Until that is done, a dropped webhook needs manual reconciliation.

Nothing else needs a cron. Cart expiry, stock release and coupon windows are all
evaluated on read.

---

## 7. Headers, caching and monitoring

Security headers (CSP, HSTS, `frame-ancestors`, `Permissions-Policy`, COOP,
`X-Content-Type-Options`, `Referrer-Policy`) are set in `next.config.ts` and
therefore ship with the application. If a CDN or proxy in front of the app also
sets these, make sure it does not weaken them. The two deliberate CSP
compromises are documented in `docs/security.md` §7; they are compromises, not
oversights, and they should be revisited.

`GET /api/health` is the liveness and readiness probe. It returns `200` with
`{ status: "ok", database: "ok" }` when the process can reach Postgres and `503`
when it cannot. It deliberately reports nothing that would help fingerprint the
deployment.

Set `SENTRY_DSN` to enable error reporting. `LOG_LEVEL` controls verbosity;
`info` is the production default. The logger redacts passwords, tokens and
payment fields — do not add log lines that bypass it.

Worth alerting on: `503` from `/api/health`, webhook handler failures, order
transition errors, and reservation failures that are not ordinary out-of-stock.

---

## 8. Pre-launch checklist

Technical:

- [ ] `npm ci && npm run build` succeeds on the target Node version
- [ ] `npm run test` (unit + integration) passes against a real Postgres
- [ ] `npm run test:e2e` passes against a deployed staging URL
- [ ] `prisma migrate deploy` applied; `pg_trgm` present
- [ ] `PAYMENT_PROVIDER=stripe`, live keys set, webhook registered and verified
- [ ] Test-mode purchase, decline and refund all verified end to end (§4)
- [ ] `E2E_RELAX_AUTH_RATE_LIMIT` unset or `false`
- [ ] Redis configured if running more than one instance
- [ ] Backups scheduled **and a restore rehearsed**
- [ ] Health check wired to the platform's probe
- [ ] Sitemap and `robots.txt` reachable; staging not indexable
- [ ] `reconcilePendingPayments` scheduled (§6)

Business and legal — **these are not engineering sign-offs**:

- [ ] Legal pages reviewed and approved by a qualified adviser. The shipped text
      is a template, marked as requiring review, and it makes no guarantees the
      business has not agreed to
- [ ] Real company details, trading name and support contact in place
- [ ] Tax jurisdiction and rates confirmed with an accountant
- [ ] Shipping rates and delivery estimates confirmed with the carrier
- [ ] Every seeded demo account removed from production
- [ ] Real staff accounts created with the narrowest role that works —
      `STAFF` or `MANAGER`, not `SUPER_ADMIN` by default

---

## 9. Rollback

Application rollback is redeploying the previous build. Database rollback is not
symmetric: the migrations are additive, so an older application version runs
against a newer schema in most cases, but a migration that adds a `NOT NULL`
column would break it. Check the pending migration before deploying and decide
the rollback path then, not during an incident.

If a release has to be reverted after orders were placed against it, the order,
payment and inventory ledgers are append-only, so the history stays intact and
can be reconciled.
