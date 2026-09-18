"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelOrderAsCustomer, requestReturn } from "../orders";
import { toActionError, type ActionResult } from "../errors";
import { requireActor } from "../auth/session";
import { cuid } from "../validation/common";

/** Customer-initiated order actions. Ownership is enforced in the service. */

export async function cancelOrderAction(input: unknown): Promise<ActionResult<{ cancelled: true }>> {
  try {
    const { orderId, reason } = z
      .object({ orderId: cuid, reason: z.string().trim().max(300).optional() })
      .parse(input);

    const actor = await requireActor();
    await cancelOrderAsCustomer(orderId, actor.id, reason);

    revalidatePath(`/account/orders/${orderId}`);
    revalidatePath("/account/orders");
    return { ok: true, data: { cancelled: true } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function requestReturnAction(input: unknown): Promise<ActionResult<{ requested: true }>> {
  try {
    const parsed = z
      .object({
        orderId: cuid,
        reason: z.string().trim().min(3).max(200),
        comment: z.string().trim().max(1000).optional(),
        items: z.array(z.object({ orderItemId: cuid, quantity: z.number().int().min(1).max(999) })).min(1),
      })
      .parse(input);

    const actor = await requireActor();
    await requestReturn({
      orderId: parsed.orderId,
      userId: actor.id,
      reason: parsed.reason,
      comment: parsed.comment,
      items: parsed.items,
    });

    revalidatePath(`/account/orders/${parsed.orderId}`);
    return { ok: true, data: { requested: true } };
  } catch (error) {
    return toActionError(error);
  }
}
