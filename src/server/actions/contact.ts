"use server";

import { z } from "zod";
import { prisma } from "../db";
import { toActionError, type ActionResult } from "../errors";
import { rateLimit, RATE_LIMITS } from "../rate-limit";
import { getActor, requestIp } from "../auth/session";
import { emailSchema } from "../validation/common";
import { logger } from "../logger";

/**
 * Contact form.
 *
 * Messages are recorded and logged rather than emailed onward, so a
 * misconfigured mail provider cannot silently swallow a customer's question.
 * Rate limited per IP to keep the form from becoming a spam relay.
 */
export async function sendContactMessageAction(input: unknown): Promise<ActionResult<{ received: true }>> {
  try {
    const parsed = z
      .object({
        name: z.string().trim().min(2).max(120),
        email: emailSchema,
        topic: z.string().trim().max(80),
        orderNumber: z.string().trim().max(40).optional().or(z.literal("")),
        message: z.string().trim().min(10).max(4000),
      })
      .parse(input);

    const ip = await requestIp();
    const limit = await rateLimit(`contact:${ip}`, RATE_LIMITS.contact);
    if (!limit.success) {
      return { ok: false, code: "RATE_LIMITED", message: "Too many messages. Please try again later." };
    }

    const actor = await getActor();

    await prisma.notification.create({
      data: {
        // Routed to the customer's own record when signed in; otherwise held
        // against the first administrator so it appears in someone's queue.
        userId: actor?.id ?? (await firstAdminId()),
        channel: "IN_APP",
        type: "CONTACT_MESSAGE",
        title: `${parsed.topic}: ${parsed.name}`,
        body: `${parsed.email}${parsed.orderNumber ? ` · ${parsed.orderNumber}` : ""}\n\n${parsed.message}`,
      },
    });

    logger.info("contact.message_received", { topic: parsed.topic, hasOrderNumber: Boolean(parsed.orderNumber) });
    return { ok: true, data: { received: true } };
  } catch (error) {
    return toActionError(error);
  }
}

async function firstAdminId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin) throw new Error("No administrator account to route the message to");
  return admin.id;
}
