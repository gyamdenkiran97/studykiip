"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { CartView } from "@/server/cart";
import {
  addToCartAction,
  applyCouponAction,
  removeCartItemAction,
  removeCouponAction,
  setSavedForLaterAction,
  updateCartItemAction,
} from "@/server/actions/cart";

/**
 * Client-side cart state.
 *
 * The server remains the source of truth: each action returns the recomputed
 * cart and we replace local state with it. We never compute a total here.
 */

type CartContextValue = {
  cart: CartView;
  pending: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  add: (variantId: string, quantity?: number, options?: { silent?: boolean }) => Promise<boolean>;
  update: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  setSaved: (itemId: string, saved: boolean) => Promise<void>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  initialCart,
  children,
}: {
  initialCart: CartView;
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState(initialCart);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    async <T,>(
      operation: () => Promise<
        { ok: true; data: CartView } | { ok: false; code: string; message: string }
      >,
      options: { successMessage?: string; onSuccess?: () => void } = {},
    ): Promise<boolean> => {
      const result = await operation();
      if (result.ok) {
        setCart(result.data);
        options.onSuccess?.();
        if (options.successMessage) toast.success(options.successMessage);
        return true;
      }
      toast.error(result.message);
      return false;
    },
    [],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      pending,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      add: async (variantId, quantity = 1, options = {}) =>
        run(() => addToCartAction({ variantId, quantity }), {
          onSuccess: () => {
            if (!options.silent) setDrawerOpen(true);
          },
        }),
      update: async (itemId, quantity) => {
        startTransition(() => {});
        await run(() => updateCartItemAction({ itemId, quantity }));
      },
      remove: async (itemId) => {
        await run(() => removeCartItemAction({ itemId }), { successMessage: "Removed from basket" });
      },
      setSaved: async (itemId, saved) => {
        await run(() => setSavedForLaterAction({ itemId, saved }));
      },
      applyCoupon: async (code) =>
        run(() => applyCouponAction({ code }), { successMessage: "Discount applied" }),
      removeCoupon: async () => {
        await run(() => removeCouponAction());
      },
    }),
    [cart, drawerOpen, pending, run],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside a CartProvider");
  return context;
}
