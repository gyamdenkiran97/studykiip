"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { toActionError, type ActionResult } from "@/server/errors";
import { requestIp, requirePermission } from "@/server/auth/session";
import { recordAudit } from "@/server/audit";
import { moderateReview } from "@/server/reviews";
import { cuid } from "@/server/validation/common";

export async function moderateReviewAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  try {
    const { reviewId, status, note } = z
      .object({
        reviewId: cuid,
        status: z.enum(["PUBLISHED", "REJECTED"]),
        note: z.string().trim().max(300).optional(),
      })
      .parse(input);

    const actor = await requirePermission("review:moderate");
    await moderateReview(reviewId, status, note);

    await recordAudit({
      actor,
      action: "review.moderated",
      entityType: "Review",
      entityId: reviewId,
      metadata: { status, note },
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/reviews");
    return { ok: true, data: { status } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateCustomerAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = z
      .object({
        userId: cuid,
        status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(),
        adminNotes: z.string().trim().max(2000).optional(),
      })
      .parse(input);

    const actor = await requirePermission("customer:write");

    await prisma.user.update({
      where: { id: parsed.userId },
      data: {
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.adminNotes !== undefined ? { adminNotes: parsed.adminNotes } : {}),
      },
    });

    // Suspending an account should also end its sessions immediately.
    if (parsed.status && parsed.status !== "ACTIVE") {
      await prisma.session.deleteMany({ where: { userId: parsed.userId } });
    }

    await recordAudit({
      actor,
      action: "customer.updated",
      entityType: "User",
      entityId: parsed.userId,
      metadata: { status: parsed.status },
      ipAddress: await requestIp(),
    });

    revalidatePath(`/admin/customers/${parsed.userId}`);
    revalidatePath("/admin/customers");
    return { ok: true, data: { id: parsed.userId } };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Role changes are reserved for the super administrator, and an account can
 * never change its own role — that is how a compromised staff session would
 * escalate itself.
 */
export async function updateUserRoleAction(input: unknown): Promise<ActionResult<{ role: string }>> {
  try {
    const { userId, role } = z
      .object({
        userId: cuid,
        role: z.enum(["CUSTOMER", "STAFF", "MANAGER", "ADMIN", "SUPER_ADMIN"]),
      })
      .parse(input);

    const actor = await requirePermission("user:role:write");
    if (actor.id === userId) {
      return { ok: false, code: "FORBIDDEN", message: "You cannot change your own role." };
    }

    await prisma.user.update({ where: { id: userId }, data: { role } });
    await prisma.session.deleteMany({ where: { userId } });

    await recordAudit({
      actor,
      action: "user.role_changed",
      entityType: "User",
      entityId: userId,
      metadata: { role },
      ipAddress: await requestIp(),
    });

    revalidatePath(`/admin/customers/${userId}`);
    return { ok: true, data: { role } };
  } catch (error) {
    return toActionError(error);
  }
}
