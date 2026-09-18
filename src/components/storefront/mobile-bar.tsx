"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, Search, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { useCart } from "./cart-provider";
import { SearchPanel } from "./search-panel";

/**
 * Persistent mobile bar. Mobile commerce lives and dies on reach: search,
 * wishlist, account and basket stay within a thumb's travel at all times.
 */
export function MobileBar() {
  const pathname = usePathname();
  const { cart, openDrawer } = useCart();

  if (pathname.startsWith("/checkout")) return null;

  const itemClass = "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] tracking-[0.06em] uppercase";

  return (
    <nav
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <Link href="/" className={cn(itemClass, pathname === "/" ? "text-ink" : "text-muted")}>
        <Home size={19} strokeWidth={1.5} />
        Home
      </Link>

      <SearchPanel
        trigger={
          <button type="button" className={cn(itemClass, "text-muted")}>
            <Search size={19} strokeWidth={1.5} />
            Search
          </button>
        }
      />

      <Link
        href="/wishlist"
        className={cn(itemClass, pathname.startsWith("/wishlist") ? "text-ink" : "text-muted")}
      >
        <Heart size={19} strokeWidth={1.5} />
        Saved
      </Link>

      <button type="button" onClick={openDrawer} className={cn(itemClass, "relative text-muted")}>
        <span className="relative">
          <ShoppingBag size={19} strokeWidth={1.5} />
          {cart.itemCount > 0 ? (
            <span className="tabular absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center bg-clay px-1 text-[9px] leading-none font-semibold text-paper">
              {cart.itemCount}
            </span>
          ) : null}
        </span>
        Basket
      </button>

      <Link
        href="/account"
        className={cn(itemClass, pathname.startsWith("/account") ? "text-ink" : "text-muted")}
      >
        <User size={19} strokeWidth={1.5} />
        Account
      </Link>
    </nav>
  );
}
