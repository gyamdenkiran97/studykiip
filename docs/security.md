# Security

What is defended, how, and where the compromises are. Written to be checked
rather than admired: every claim below corresponds to code you can open, and
most correspond to a test.

## Threat model

This is a shop. The assets worth protecting, in order:

1. **Customers' money** — nobody should be charged the wrong amount, twice, or
   for something they did not order.
2. **Customers' data** — addresses, order history, email addresses.
3. **Inventory truth** — overselling costs money and trust.
4. **Administrative capability** — a compromised staff account is the worst case.

Card numbers are deliberately outside the model: they never reach this
application.

## Authentication

| Concern | Measure |
| --- | --- |
| Password storage | scrypt via Better Auth. This codebase never hashes, compares or stores a password itself. |
| Password policy | Minimum 10 characters, maximum 200, no composition rules — length is what matters (NIST SP 800-63B). |
| Session storage | Signed, HttpOnly, SameSite=Lax cookie; Secure in production. JavaScript cannot read it. |
| Session lifetime | 30 days, refreshed daily; a 15-minute freshness window guards sensitive operations. |
| Brute force | Better Auth limits sign-in to 8 attempts per 10 minutes, sign-up and reset to 5 per hour, per IP. |
| Account enumeration | Sign-in failures return one message whatever the cause. Password reset confirms nothing about whether the address exists. Tested end to end by comparing responses for a real and a fake address. |
| Suspension | Setting an account to SUSPENDED deletes its sessions immediately. |
| Privilege escalation | Role changes require `user:role:write` (super administrator only) and can never be applied to your own account. Any role change signs that account out everywhere. |

`E2E_RELAX_AUTH_RATE_LIMIT` raises these limits for the end-to-end suite. The
application refuses to boot with it enabled in production
(`src/server/env.ts`).

## Authorisation

Two layers, checked independently:

- **Route**: `src/app/(admin)/admin/layout.tsx` blocks the whole admin tree, and
  redirects rather than explaining — a customer probing `/admin` learns nothing.
- **Operation**: every admin server action begins with `requirePermission(...)`.
  The UI hides what you cannot do, but hiding is presentation; the server is the
  control.

Roles are coarse (`CUSTOMER → STAFF → MANAGER → ADMIN → SUPER_ADMIN`) and
permissions are fine-grained, with individual grants layered on top. The actor's
role is re-read from the database on every request rather than trusted from the
session cookie, so a demotion takes effect immediately.

**IDOR** is prevented by scoping rather than checking: `getOrderForUser(id,
userId)` puts the owner in the `WHERE` clause, so another customer's order id
returns "not found" rather than a permission error. Addresses and carts work the
same way. Tested in `tests/integration/orders.test.ts`.

## Payments

The rules, in order of importance:

1. **The amount comes from the order.** `createOrderFromCart` recomputes every
   line from the catalogue inside one transaction. The browser sends variant ids
   and quantities; it never sends a price.
2. **Only a verified webhook marks an order paid.** The success redirect is
   treated as a hint. `handlePaymentWebhook` is the only path to `PAID`.
3. **Signatures are verified before anything is parsed.** The raw body is read
   as text; an unsigned or wrongly signed request gets 403 and never reaches the
   handler.
4. **Replays are no-ops.** The provider's event id is written first, under a
   unique constraint. A duplicate delivery returns `duplicate` and changes
   nothing — including coupon usage counts.
5. **Amounts are cross-checked.** An event whose amount disagrees with the stored
   payment is refused and logged.
6. **Retries do not double-charge.** Intent creation and refunds both use
   idempotency keys derived from the order and amount.

Card data never touches this server: the browser talks to the provider's hosted
element directly. We store the provider's reference, the card brand and the last
four digits.

## Input validation

Every server action and route handler parses its input with a Zod schema before
touching the database (`src/server/validation`). Nothing reads `formData` fields
directly into a query.

- **SQL injection**: all database access goes through Prisma. The few raw
  queries use tagged templates, which parameterise; an injection attempt in the
  search box is matched as literal text (there is a test for exactly that).
- **XSS**: React escapes by default. `dangerouslySetInnerHTML` appears once, for
  JSON-LD, where the payload is built from typed objects, serialised with
  `JSON.stringify`, and `<` is escaped so no value can close the script element.
- **Open redirect**: `safeRedirectPath` accepts same-site paths only; anything
  else falls back. Applied to every `next=` parameter.
- **Mass assignment**: schemas list the fields they accept; `role` and `status`
  are not among the inputs a user can set on themselves.

## Rate limiting

Named policies in `src/server/rate-limit/index.ts`, applied to sign-in, sign-up,
password reset, coupon attempts, review submission, search, contact and
checkout. The limiter fails **open** on a store outage and logs loudly — a Redis
problem should not take the shop down, but it should be visible.

In development the store is in-process. In production, set
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` so limits hold across
instances.

## HTTP headers

Set in `next.config.ts` and asserted by an end-to-end test:

- `Content-Security-Policy` with `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` denying camera, microphone and geolocation
- `Cross-Origin-Opener-Policy: same-origin`
- `Strict-Transport-Security` with a two-year max-age, production only
- `X-Powered-By` removed

**Two documented CSP compromises**, both in `next.config.ts`:

- `'unsafe-inline'` for **styles**. Tailwind and React inline critical CSS and
  style attributes. Removing it requires a nonce-based style pipeline; the gain
  is small because injected CSS cannot execute.
- `'unsafe-eval'` for **scripts in development only**. The dev server's hot
  reloading needs it. Production gets neither it nor inline script.

## Secrets

Secrets live in environment variables, validated at boot by
`src/server/env.ts`, which refuses to start a production server with the mock
payment provider or the test rate-limit flag enabled. `.env` is gitignored;
`.env.example` documents every variable with no values.

The structured logger redacts a list of secret-bearing keys at any depth
(`password`, `token`, `apiKey`, `cardNumber`, `authorization`, and others) and
reduces `Error` objects to name and message. The audit log scrubs the same keys
again. Both behaviours are unit tested.

## Auditing and observability

Every administrative mutation writes an `AuditLog` row: actor, action, entity,
scrubbed metadata, IP address. Payment webhooks are persisted in full before
they are acted on, which doubles as the replay guard. `/api/health` reports
liveness and database reachability without disclosing versions.

## Known gaps

Stated plainly, because a security document that claims completeness is not
credible:

- **No CSRF token.** Next's Server Actions are same-origin by construction and
  the session cookie is `SameSite=Lax`, which covers the classic attack. A
  token-based defence would be needed if the API were opened to other origins.
- **No file uploads.** Product media is generated or referenced by URL. An
  upload path needs type sniffing, size limits, a separate origin and virus
  scanning before it is added.
- **No breached-password check.** A Have I Been Pwned lookup would strengthen
  registration; it was left out rather than add a hard dependency on an external
  service during sign-up.
- **No two-factor authentication** for staff accounts. This is the single most
  valuable addition for a real deployment.
- **Email verification is not enforced** before checkout. Turn on
  `requireEmailVerification` once a mail provider is configured.
- **Legal and tax text is placeholder** and must be reviewed before trading.
