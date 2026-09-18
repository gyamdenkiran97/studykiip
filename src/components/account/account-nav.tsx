"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { signOut } from "@/lib/auth-client";

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/profile", label: "Profile & security" },
];

export function AccountNav({ isStaff }: { isStaff: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav aria-label="Account" className="mt-7">
      <ul className="space-y-0.5">
        {LINKS.map((link) => {
          const active = link.href === "/account" ? pathname === "/account" : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block border-l-2 py-2 pl-3 text-[14px] transition-colors",
                  active
                    ? "border-ink font-medium text-ink"
                    : "border-transparent text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
        {isStaff ? (
          <li>
            <Link
              href="/admin"
              className="block border-l-2 border-transparent py-2 pl-3 text-[14px] text-clay hover:border-clay"
            >
              Admin dashboard
            </Link>
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.push("/");
          router.refresh();
        }}
        className="mt-6 inline-flex items-center gap-2 pl-3 text-[13.5px] text-muted transition-colors hover:text-ink"
      >
        <LogOut size={15} strokeWidth={1.6} />
        Sign out
      </button>
    </nav>
  );
}
