"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../db";
import { forbidden, notFound, toActionError, validationError, type ActionResult } from "../errors";
import { requireActor } from "../auth/session";
import { addressSchema, cuid } from "../validation/common";
import { auth } from "../auth/config";
import { headers } from "next/headers";
import { logger } from "../logger";

/**
 * Account management.
 *
 * Every mutation re-reads the actor from the session and scopes the query by
 * their id — an address id from another account cannot be edited by posting it
 * here.
 */

export async function saveAddressAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = z
      .object({
        id: cuid.optional(),
        type: z.enum(["SHIPPING", "BILLING"]).default("SHIPPING"),
        isDefault: z.boolean().default(false),
      })
      .and(addressSchema)
      .parse(input);

    const actor = await requireActor();

    const data = {
      fullName: parsed.fullName,
      company: parsed.company || null,
      line1: parsed.line1,
      line2: parsed.line2 || null,
      city: parsed.city,
      region: parsed.region,
      postalCode: parsed.postalCode,
      countryCode: parsed.countryCode,
      phone: parsed.phone || null,
      type: parsed.type,
      isDefault: parsed.isDefault,
    };

    let addressId: string;

    if (parsed.id) {
      const existing = await prisma.address.findFirst({
        where: { id: parsed.id, userId: actor.id, deletedAt: null },
        select: { id: true },
      });
      if (!existing) throw notFound("That address could not be found.");
      await prisma.address.update({ where: { id: existing.id }, data });
      addressId = existing.id;
    } else {
      const created = await prisma.address.create({ data: { ...data, userId: actor.id } });
      addressId = created.id;
    }

    if (parsed.isDefault) {
      await prisma.address.updateMany({
        where: { userId: actor.id, type: parsed.type, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return { ok: true, data: { id: addressId } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteAddressAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const { id } = z.object({ id: cuid }).parse(input);
    const actor = await requireActor();

    const address = await prisma.address.findFirst({
      where: { id, userId: actor.id, deletedAt: null },
      select: { id: true },
    });
    if (!address) throw notFound("That address could not be found.");

    // Soft delete: orders reference the address they were shipped to.
    await prisma.address.update({ where: { id: address.id }, data: { deletedAt: new Date(), isDefault: false } });

    revalidatePath("/account/addresses");
    return { ok: true, data: { id: address.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateProfileAction(input: unknown): Promise<ActionResult<{ updated: true }>> {
  try {
    const parsed = z
      .object({
        name: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(32).optional().or(z.literal("")),
        marketingOptIn: z.boolean().default(false),
      })
      .parse(input);

    const actor = await requireActor();
    await prisma.user.update({
      where: { id: actor.id },
      data: {
        name: parsed.name,
        phone: parsed.phone || null,
        marketingOptIn: parsed.marketingOptIn,
      },
    });

    revalidatePath("/account/profile");
    return { ok: true, data: { updated: true } };
  } catch (error) {
    return toActionError(error);
  }
}

/** Sign out every other session — the "I used a shared computer" button. */
export async function revokeOtherSessionsAction(): Promise<ActionResult<{ revoked: number }>> {
  try {
    const actor = await requireActor();
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session) throw forbidden();

    const result = await prisma.session.deleteMany({
      where: { userId: actor.id, token: { not: session.session.token } },
    });

    logger.info("auth.other_sessions_revoked", { userId: actor.id, count: result.count });
    revalidatePath("/account/profile");
    return { ok: true, data: { revoked: result.count } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function changePasswordAction(input: unknown): Promise<ActionResult<{ changed: true }>> {
  try {
    const parsed = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(10).max(200),
      })
      .parse(input);

    await requireActor();

    // Delegated to Better Auth: it verifies the current password, re-hashes the
    // new one and rotates sessions. We never touch a hash ourselves.
    const result = await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: parsed.currentPassword,
        newPassword: parsed.newPassword,
        revokeOtherSessions: true,
      },
    });

    if (!result) throw validationError("Your current password is not correct.");
    return { ok: true, data: { changed: true } };
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("password")) {
      return { ok: false, code: "VALIDATION", message: "Your current password is not correct." };
    }
    return toActionError(error);
  }
}
