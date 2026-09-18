import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { getActor } from "@/server/auth/session";
import { getWishlist } from "@/server/wishlist";
import { ProductGrid } from "@/components/storefront/product-grid";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export default async function WishlistPage() {
  const actor = await getActor();

  if (!actor) {
    return (
      <div className="shell flex flex-col items-center py-24 text-center">
        <Heart size={36} strokeWidth={0.9} className="text-muted-soft" aria-hidden="true" />
        <h1 className="mt-6 text-display-3">Your wishlist</h1>
        <p className="mt-3 max-w-sm text-[15px] text-muted">
          Sign in to save products and find them again from any device.
        </p>
        <div className="mt-7 flex gap-3">
          <Button asChild size="lg">
            <Link href="/sign-in?next=/wishlist">Sign in</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/sign-up?next=/wishlist">Create an account</Link>
          </Button>
        </div>
      </div>
    );
  }

  const products = await getWishlist();
  const wishlisted = new Set(products.map((product) => product.id));

  return (
    <div className="shell py-10 lg:py-14">
      <h1 className="text-display-2">Wishlist</h1>
      <p className="mt-2 text-[14px] text-muted">
        {products.length} {products.length === 1 ? "saved item" : "saved items"}
      </p>

      {products.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-display text-xl">Nothing saved yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Tap the heart on any product to keep it here.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/shop">Browse the mall</Link>
          </Button>
        </div>
      ) : (
        <ProductGrid products={products} wishlisted={wishlisted} className="mt-10" />
      )}
    </div>
  );
}
