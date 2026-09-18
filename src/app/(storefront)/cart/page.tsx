import type { Metadata } from "next";
import { getCartView } from "@/server/cart";
import { CartPageView } from "@/components/storefront/cart-page";

export const metadata: Metadata = {
  title: "Your basket",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const cart = await getCartView();
  return <CartPageView initialCart={cart} />;
}
