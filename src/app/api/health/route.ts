import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { env } from "@/server/env";

/**
 * Liveness and readiness probe.
 *
 * Reports whether the process is up and whether it can reach the database.
 * Deliberately terse: no version numbers, no dependency versions, nothing that
 * helps someone fingerprint the deployment.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        database: "ok",
        latencyMs: Date.now() - startedAt,
        environment: env.NODE_ENV,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
