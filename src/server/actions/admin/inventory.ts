"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adjustStock } from "@/server/inventory";
import { toActionError, type ActionResult } from "@/server/errors";
import { requestIp, requirePermission } from "@/server/auth/session";
import { recordAudit } from "@/server/audit";
import { cuid } from "@/server/validation/common";

export async function adjustStockAction(
  input: unknown,
): Promise<ActionResult<{ onHand: number; available: number }>> {
  try {
    const parsed = z
      .object({
        variantId: cuid,
        onHandDelta: z.number().int(),
        reason: z.enum(["RESTOCK", "DAMAGE", "CORRECTION", "RETURN", "INITIAL"]),
        note: z.string().trim().max(300).optional(),
      })
      .parse(input);

    const actor = await requirePermission("inventory:write");

    const result = await adjustStock({
      variantId: parsed.variantId,
      onHandDelta: parsed.onHandDelta,
      reason: parsed.reason,
      note: parsed.note,
      actorId: actor.id,
    });

    await recordAudit({
      actor,
      action: "inventory.adjusted",
      entityType: "ProductVariant",
      entityId: parsed.variantId,
      metadata: { delta: parsed.onHandDelta, reason: parsed.reason, note: parsed.note },
      ipAddress: await requestIp(),
    });

    revalidatePath("/admin/inventory");
    return { ok: true, data: { onHand: result.onHand, available: result.available } };
  } catch (error) {
    return toActionError(error);
  }
}
