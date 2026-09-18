"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, type ActionResult } from "../errors";
import { toggleWishlistItem } from "../wishlist";
import { cuid } from "../validation/common";

export async function toggleWishlistAction(
  input: unknown,
): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const { productId, variantId } = z
      .object({ productId: cuid, variantId: cuid.nullish() })
      .parse(input);
    const saved = await toggleWishlistItem(productId, variantId ?? null);
    revalidatePath("/wishlist");
    revalidatePath("/account/wishlist");
    return { ok: true, data: { saved } };
  } catch (error) {
    return toActionError(error);
  }
}
