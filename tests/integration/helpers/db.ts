import { execSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Integration test database.
 *
 * Runs against a real PostgreSQL instance — the constraints, row locks and
 * transaction semantics under test do not exist in a mock. The schema is
 * applied once per run and tables are truncated between tests.
 */

const connectionString =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL?.replace(/\/([^/?]+)(\?|$)/, "/kiipmall_test$2") ??
  "postgresql://kiip:kiip_dev_password@127.0.0.1:5432/kiipmall_test";

export const testDb = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let schemaReady = false;

export function ensureSchema(): void {
  if (schemaReady) return;
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: connectionString },
    stdio: "pipe",
  });
  schemaReady = true;
}

/** Wipe every table but keep the schema. Fast enough to run before each test. */
export async function resetDatabase(): Promise<void> {
  const tables = await testDb.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const list = tables.map((row) => `"public"."${row.tablename}"`).join(", ");
  await testDb.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function disconnect(): Promise<void> {
  await testDb.$disconnect();
}
