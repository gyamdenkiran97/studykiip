"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addToCart,
  applyCoupon,
  getCartView,
  removeCartItem,
  removeCoupon,
  setSavedForLater,
  updateCartItem,
  type CartView,
} from "../cart";
import { toActionError, type ActionResult } from "../errors";
import { rateLimit, RATE_LIMITS } from "../rate-limit";
import { getActor, requestIp } from "../auth/session";
import { couponCode, cuid, quantity } from "../validation/common";
import { trackServerEvent } from "../analytics";

/**
 * Cart mutations.
 *
 * Every action validates its input, performs the change server-side, and
 * returns the freshly recomputed cart. The client never sends a price.
 */

const addSchema = z.object({ variantId: cuid, quantity: z.number().int().min(1).max(20) });
const updateSchema = z.object({ itemId: cuid, quantity });
const savedSchema = z.object({ itemId: cuid, saved: z.boolean() });
const couponSchema = z.object({ code: couponCode });

function revalidateCartRoutes() {
  revalidatePath("/cart");
  revalidatePath("/checkout");
}

export async function addToCartAction(input: unknown): Promise<ActionResult<CartView>> {
  try {
    const { variantId, quantity: qty } = addSchema.parse(input);
    const view = await addToCart(variantId, qty);
    await trackServerEvent("add_to_cart", { variantId, quantity: qty });
    revalidateCartRoutes();
    return { ok: true, data: view };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateCartItemAction(input: unknown): Promise<ActionResult<CartView>> {
  try {
    const { itemId, quantity: qty } = updateSchema.parse(input);
    const view = await updateCartItem(itemId, qty);
    revalidateCartRoutes();
    return { ok: true, data: view };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeCartItemAction(input: unknown): Promise<ActionResult<CartView>> {
  try {
    const { itemId } = z.object({ itemId: cuid }).parse(input);
    const view = await removeCartItem(itemId);
    await trackServerEvent("remove_from_cart", { itemId });
    revalidateCartRoutes();
    return { ok: true, data: view };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setSavedForLaterAction(input: unknown): Promise<ActionResult<CartView>> {
  try {
    const { itemId, saved } = savedSchema.parse(input);
    const view = await setSavedForLater(itemId, saved);
    revalidateCartRoutes();
    return { ok: true, data: view };
  } catch (error) {
    return toActionError(error);
  }
}

export async function applyCouponAction(input: unknown): Promise<ActionResult<CartView>> {
  try {
    const { code } = couponSchema.parse(input);
    const actor = await getActor();
    // Codes are guessable; limit attempts per actor or IP.
    const limit = await rateLimit(`coupon:${actor?.id ?? (await requestIp())}`, RATE_LIMITS.coupon);
    if (!limit.success) {
      return { ok: false, code: "RATE_LIMITED", message: "Too many code attempts. Try again shortly." };
    }
    const view = await applyCoupon(code);
    revalidateCartRoutes();
    return { ok: true, data: view };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeCouponAction(): Promise<ActionResult<CartView>> {
  try {
    const view = await removeCoupon();
    revalidateCartRoutes();
    return { ok: true, data: view };
  } catch (error) {
    return toActionError(error);
  }
}

export async function refreshCartAction(): Promise<ActionResult<CartView>> {
  try {
    return { ok: true, data: await getCartView() };
  } catch (error) {
    return toActionError(error);
  }
}
