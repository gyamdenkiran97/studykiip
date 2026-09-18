# Kiip Mall — build progress

> Working log for this repository. Read this first when resuming with fresh context,
> then `tests.json`, then `git log --oneline`, then run `npm run test`.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · PostgreSQL 16 · Prisma 7
· Tailwind 4 · Better Auth · Stripe (behind a provider interface) · Vitest · Playwright

## How to run this project locally

```bash
cp .env.example .env          # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm install
npm run db:migrate            # applies prisma/migrations
npm run db:seed               # demo catalog + demo accounts (passwords from .env)
npm run dev                   # http://localhost:3000
```

## Milestones

| # | Milestone | Status |
| --- | --- | --- |
| M0 | Research + architecture | ✅ done |
| M1 | Foundation + design system | 🚧 in progress |
| M2 | Database + authentication | 🚧 in progress |
| M3 | Catalog | ⬜ not started |
| M4 | Storefront | ⬜ not started |
| M5 | Cart + wishlist | ⬜ not started |
| M6 | Checkout + payment sandbox | ⬜ not started |
| M7 | Orders + inventory | ⬜ not started |
| M8 | Admin panel | ⬜ not started |
| M9 | Emails + search + reviews | ⬜ not started |
| M10 | 3D / motion polish | ⬜ not started |
| M11 | Security / performance / accessibility | ⬜ not started |
| M12 | End-to-end QA | ⬜ not started |
| M13 | Production deployment preparation | ⬜ not started |

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
  the written brief's principles only. See `docs/design-system.md` for the originality
  statement.
- Scaffolded the Next.js app, wrote the full Prisma schema (55 models), applied the
  initial migration.

## Open questions for the product owner
These use documented development placeholders until answered (see §46 of the brief):
- Legal entity name, trading address, and support contact details.
- Real payment credentials (Stripe account) and the live webhook endpoint.
- Currency and tax jurisdiction(s) to launch in — currently GBP with a placeholder
  20% standard rate and a 0% reduced rate.
- Real shipping zones, carriers, and rates.
- Legal review of the Terms/Privacy/Shipping/Returns templates before launch.
