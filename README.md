# Kwidus21

A multi-category online department store — fashion, electronics, beauty, home,
furniture, sport, food and more — built to work, not to demo. Real inventory
that cannot be oversold, server-calculated prices, webhook-confirmed payments,
and a permission-checked back office where an administrator can add a whole new
department without a deployment.

**Status: feature-complete and verified locally. Not deployed.** No hosting
account, no payment credentials, no domain. See `docs/deployment.md` for what a
launch needs.

---

## Running it

Requires Node 22 and PostgreSQL 16.

```bash
cp .env.example .env    # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm install
npm run db:migrate      # apply prisma/migrations
npm run db:seed         # demo catalogue + demo accounts (passwords from .env)
npm run dev             # http://localhost:3000
```

The back office is at `/admin`, reachable with a staff account. The seed creates
one from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — there are no hard-coded
credentials anywhere in the codebase.

Payments default to a deterministic local provider (`PAYMENT_PROVIDER=mock`), so
a full purchase works offline. The application refuses to boot with that setting
in production.

## Testing

```bash
npm run test       # 126 unit + integration tests (needs a PostgreSQL test database)
npm run test:e2e   # 67 end-to-end tests against a running app
npm run lint
npm run typecheck
```

Integration tests run against real PostgreSQL rather than a mock — row locks,
CHECK constraints and transaction semantics are precisely what they exist to
verify, and precisely what a mock would fake away.

`tests.json` maps every requirement to the file that proves it, and lists what
the suite does *not* verify.

## How it is built

Next.js 16 (App Router, React 19, Server Components and Server Actions),
TypeScript in strict mode, PostgreSQL 16 via Prisma 7, Tailwind CSS 4, and
Better Auth. Full reasoning for every dependency is in
`docs/technology-decisions.md`.

Four principles the code holds to:

- **Money is never a float.** Integer minor units plus an ISO-4217 currency,
  everywhere. Rates are basis points.
- **The browser is never trusted.** Prices, stock and totals are recomputed
  server-side from the database on every request that depends on them.
- **An order is paid when the provider says so.** A browser arriving at a
  success URL changes nothing; only a signature-verified webhook does.
- **Authorisation is checked on the server, every time.** Hiding a button is
  presentation, not access control.

## Documentation

| File | Contents |
| --- | --- |
| `docs/architecture.md` | System shape and where decisions are made |
| `docs/database.md` | Schema conventions, inventory and order modelling, constraints |
| `docs/security.md` | Threat model, payment rules, headers, and known gaps |
| `docs/deployment.md` | Configuration, webhooks, pre-launch checklist |
| `docs/admin-guide.md` | Roles, every screen, everyday tasks |
| `docs/design-system.md` | Tokens, type, motion, and the originality review |
| `docs/technology-decisions.md` | Every dependency and why |
| `progress.md` | Build log, measured verification, known gaps |

## Before this handles real money

The legal pages are **templates marked as requiring review** — they make no
promises the business has agreed to. Tax rates, shipping rates and company
details are documented placeholders. The outstanding items are listed at the end
of `progress.md` and in `docs/deployment.md` §3.
