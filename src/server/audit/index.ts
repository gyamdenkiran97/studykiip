import "server-only";
import { prisma } from "../db";
import { logger } from "../logger";
import type { Actor } from "../auth/session";

/**
 * Administrative audit trail. Records who changed what, when, and from where.
 * Metadata is caller-supplied and must never include secrets — the logger's
 * redaction list is mirrored here for defence in depth.
 */

const REDACT_KEYS = new Set(["password", "token", "secret", "apiKey", "cardNumber", "cvc"]);

function scrub(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      REDACT_KEYS.has(key) ? "[redacted]" : value,
    ]),
  );
}

export async function recordAudit(input: {
  actor: Pick<Actor, "id" | "email"> | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: (scrub(input.metadata) ?? undefined) as never,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    // Never fail the business operation because auditing failed, but make noise.
    logger.error("audit.write_failed", { action: input.action, error });
  }
}

export async function listAudit(options: { take?: number; skip?: number; entityType?: string } = {}) {
  return prisma.auditLog.findMany({
    where: options.entityType ? { entityType: options.entityType } : undefined,
    orderBy: { createdAt: "desc" },
    take: options.take ?? 50,
    skip: options.skip ?? 0,
    include: { actor: { select: { name: true, email: true } } },
  });
}
