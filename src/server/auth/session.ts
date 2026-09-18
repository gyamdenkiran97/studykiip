import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./config";
import { prisma } from "../db";
import { forbidden, unauthenticated } from "../errors";
import { hasPermission, type Permission, type Role } from "./permissions";

/**
 * Server-side session access and authorisation guards.
 *
 * Every admin server action and route handler must go through
 * `requirePermission` — hiding a button is not access control.
 */

export type Actor = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: Role;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  grants: string[];
};

/** Deduplicated per request by React's cache(). */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  // Read role/status from the database rather than the (cacheable) session
  // cookie so a demotion or suspension takes effect immediately.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      status: true,
      deletedAt: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  if (!user || user.deletedAt || user.status !== "ACTIVE") return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    role: user.role as Role,
    status: user.status,
    grants: user.permissions.map((p) => p.permission.key),
  };
});

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw unauthenticated();
  return actor;
}

export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor();
  if (!hasPermission(actor.role, permission, actor.grants)) {
    throw forbidden(`Missing permission: ${permission}`);
  }
  return actor;
}

export async function requireAnyPermission(permissions: readonly Permission[]): Promise<Actor> {
  const actor = await requireActor();
  if (!permissions.some((p) => hasPermission(actor.role, p, actor.grants))) {
    throw forbidden("You do not have access to this area.");
  }
  return actor;
}

export async function can(permission: Permission): Promise<boolean> {
  const actor = await getActor();
  return actor ? hasPermission(actor.role, permission, actor.grants) : false;
}

/** Client IP for rate limiting and audit entries, honouring proxy headers. */
export async function requestIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
