import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

/**
 * A single Prisma client per process. Next's dev server re-evaluates modules on
 * every change, so the instance is cached on globalThis to avoid exhausting the
 * database connection pool.
 */

const createClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

type Client = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as { __kiipPrisma?: Client };

export const prisma: Client = globalForPrisma.__kiipPrisma ?? createClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.__kiipPrisma = prisma;
}

/** Transaction client type, for services that accept either. */
export type DbClient = Omit<Client, "$connect" | "$disconnect" | "$transaction" | "$extends">;
