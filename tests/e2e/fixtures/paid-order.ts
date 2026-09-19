import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * A paid order, created directly in the development database.
 *
 * The admin tests need an order that has actually been paid for, and only the
 * customer purchase flow produces one. Depending on another project's side
 * effects made those tests pass or skip according to what ran before them,
 * which is not a test. This builds exactly what they need, every time.
 *
 * Raw SQL through `pg` rather than Prisma: Playwright compiles its TypeScript
 * to CommonJS, and the generated Prisma client is ESM-only. The rows written
 * here are the same ones a real checkout writes — an order, a snapshotted line
 * item, a captured payment and a status event — so the admin screens see
 * nothing unusual.
 */

export type PaidOrder = { id: string; orderNumber: string; totalCents: number };

let client: Client | null = null;

async function connection(): Promise<Client> {
  if (client) return client;
  client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

/** Ids are opaque text columns; they need to be unique, not cuid-shaped. */
const id = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "")}`;

export async function createPaidOrder(): Promise<PaidOrder> {
  const db = await connection();
  const email = process.env.SEED_CUSTOMER_EMAIL ?? "customer@kwidus21.test";

  const { rows: users } = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM users WHERE email = $1`,
    [email],
  );
  if (users.length === 0) throw new Error(`Seed customer ${email} not found — run npm run db:seed`);
  const customer = users[0];

  const { rows: variants } = await db.query<{
    id: string;
    sku: string;
    title: string;
    currency: string;
    price: number;
    productTitle: string;
    brandName: string | null;
  }>(
    `SELECT v.id, v.sku, v.title, v.currency,
            COALESCE(v."salePriceCents", v."priceCents") AS price,
            p.title AS "productTitle", b.name AS "brandName"
       FROM product_variants v
       JOIN products p ON p.id = v."productId"
       LEFT JOIN brands b ON b.id = p."brandId"
      WHERE v."isActive" AND v."deletedAt" IS NULL
        AND p.status = 'ACTIVE' AND p."deletedAt" IS NULL
      ORDER BY v.id
      LIMIT 1`,
  );
  if (variants.length === 0) throw new Error("No active variant to sell — run npm run db:seed");
  const variant = variants[0];

  let addressId: string;
  const { rows: addresses } = await db.query<{ id: string }>(
    `SELECT id FROM addresses WHERE "userId" = $1 LIMIT 1`,
    [customer.id],
  );
  if (addresses.length > 0) {
    addressId = addresses[0].id;
  } else {
    addressId = id("adr");
    await db.query(
      `INSERT INTO addresses (id, "userId", "fullName", line1, city, region, "postalCode", "countryCode", "updatedAt")
       VALUES ($1, $2, $3, '1 Test Street', 'Leeds', 'West Yorkshire', 'LS1 1AA', 'GB', NOW())`,
      [addressId, customer.id, customer.name],
    );
  }

  const orderId = id("ord");
  const orderNumber = `KM-E2E-${randomUUID().slice(0, 8).toUpperCase()}`;
  const total = Number(variant.price);

  // One transaction, so a failure part-way leaves nothing behind.
  await db.query("BEGIN");
  try {
    await db.query(
      `INSERT INTO orders (
         id, "orderNumber", "userId", email, status, currency,
         "subtotalCents", "totalCents", "placedAt", "paidAt",
         "inventoryCommitted", "shippingAddressId", "billingAddressId", "updatedAt"
       ) VALUES ($1, $2, $3, $4, 'PAID', $5, $6, $6, NOW(), NOW(), true, $7, $7, NOW())`,
      [orderId, orderNumber, customer.id, email, variant.currency, total, addressId],
    );

    await db.query(
      `INSERT INTO order_items (
         id, "orderId", "variantId", "productTitle", "variantTitle", sku, "brandName",
         quantity, "unitPriceCents", "totalCents"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $8)`,
      [id("oi"), orderId, variant.id, variant.productTitle, variant.title, variant.sku, variant.brandName, total],
    );

    await db.query(
      `INSERT INTO payments (
         id, "orderId", provider, "providerRef", status, "amountCents", currency,
         "methodBrand", "methodLast4", "updatedAt"
       ) VALUES ($1, $2, 'mock', $3, 'SUCCEEDED', $4, $5, 'visa', '4242', NOW())`,
      [id("pay"), orderId, `pi_e2e_${randomUUID().slice(0, 12)}`, total, variant.currency],
    );

    await db.query(
      `INSERT INTO order_status_events (id, "orderId", "from", "to", note)
       VALUES ($1, $2, 'PENDING_PAYMENT', 'PAID', 'E2E fixture')`,
      [id("ose"), orderId],
    );

    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }

  return { id: orderId, orderNumber, totalCents: total };
}

export async function disconnectFixtures(): Promise<void> {
  if (!client) return;
  await client.end();
  client = null;
}
