"use server";

import { z } from "zod";
import { prisma } from "../db";
import { toActionError, type ActionResult } from "../errors";
import { rateLimit, RATE_LIMITS } from "../rate-limit";
import { requestIp } from "../auth/session";
import { emailSchema } from "../validation/common";
import { logger } from "../logger";

/**
 * Newsletter sign-up.
 *
 * Existing customers get their marketing preference updated; everyone else is
 * recorded as a pending subscriber. The response is deliberately identical
 * either way so the form cannot be used to test whether an address has an
 * account here.
 */
export async function subscribeToNewsletterAction(
  input: unknown,
): Promise<ActionResult<{ pending: true }>> {
  try {
    const { email } = z.object({ email: emailSchema }).parse(input);

    const limit = await rateLimit(`newsletter:${await requestIp()}`, RATE_LIMITS.contact);
    if (!limit.success) {
      return { ok: false, code: "RATE_LIMITED", message: "Too many attempts. Please try again later." };
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { marketingOptIn: true } });
    } else {
      await prisma.siteSetting.upsert({
        where: { key: `newsletter:${email}` },
        create: { key: `newsletter:${email}`, value: { email, subscribedAt: new Date().toISOString(), confirmed: false } },
        update: { value: { email, subscribedAt: new Date().toISOString(), confirmed: false } },
      });
    }

    logger.info("newsletter.subscribed");
    return { ok: true, data: { pending: true } };
  } catch (error) {
    return toActionError(error);
  }
}
