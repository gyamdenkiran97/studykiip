"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, ChevronRight, Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ProductImage } from "@/components/ui/product-image";
import { useCart } from "./cart-provider";
import { SearchPanel } from "./search-panel";

export type Department = {
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  children: Array<{ name: string; slug: string }>;
};

type Announcement = {
  id: string;
  headline: string;
  subtext: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

/**
 * Primary navigation.
 *
 * Desktop: a wordmark, an inline department list that opens a full-width mega
 * panel on hover or focus, and utilities on the right. The panel is keyboard
 * reachable (each trigger is a button with aria-expanded) and closes on Escape.
 *
 * Mobile: a separate drawer designed for thumbs — a two-level list rather than a
 * shrunken mega menu — plus a persistent bottom bar for search, wishlist,
 * account and basket.
 */
export function HeaderClient({
  departments,
  cartCount,
  wishlistCount,
  announcements,
  account,
}: {
  departments: Department[];
  cartCount: number;
  wishlistCount: number;
  announcements: Announcement[];
  account: { name: string; isStaff: boolean } | null;
}) {
  const pathname = usePathname();
  const { cart, openDrawer } = useCart();
  const [openDepartment, setOpenDepartment] = useState<string | null>(null);
  const [condensed, setCondensed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The provider's live count wins once the visitor has changed the basket.
  const count = cart.itemCount || cartCount;

  useEffect(() => {
    setOpenDepartment(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!openDepartment) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenDepartment(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openDepartment]);

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenDepartment(null), 140);
  }

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  const active = departments.find((department) => department.slug === openDepartment) ?? null;

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-ink focus:px-4 focus:py-2.5 focus:text-sm focus:text-paper"
      >
        Skip to content
      </a>

      <AnnouncementBar announcements={announcements} />

      <header
        className={cn(
          "sticky top-0 z-40 border-b border-line bg-paper/92 backdrop-blur-md transition-[padding] duration-300",
          condensed ? "py-0" : "py-1.5",
        )}
        onMouseLeave={scheduleClose}
      >
        <div className="shell flex items-center gap-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="-ml-2 grid h-11 w-11 place-items-center lg:hidden"
          >
            <Menu size={21} strokeWidth={1.5} />
          </button>

          <Link
            href="/"
            className="flex shrink-0 items-baseline gap-1.5 py-3.5"
            aria-label="Kiip Mall — home"
          >
            <span className="font-display text-[26px] leading-none font-semibold tracking-[-0.045em]">Kiip</span>
            <span className="hidden text-[10px] tracking-[0.28em] text-muted uppercase sm:inline">Mall</span>
          </Link>

          <nav aria-label="Departments" className="ml-6 hidden lg:block">
            <ul className="flex items-center">
              {departments.slice(0, 8).map((department) => {
                const isOpen = openDepartment === department.slug;
                return (
                  <li key={department.slug}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`mega-${department.slug}`}
                      onMouseEnter={() => {
                        cancelClose();
                        setOpenDepartment(department.slug);
                      }}
                      onFocus={() => setOpenDepartment(department.slug)}
                      onClick={() => setOpenDepartment(isOpen ? null : department.slug)}
                      className={cn(
                        "relative px-3 py-4 text-[13.5px] transition-colors",
                        "after:absolute after:inset-x-3 after:bottom-2.5 after:h-px after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 after:content-['']",
                        isOpen ? "text-ink after:scale-x-100" : "text-ink-soft hover:text-ink",
                      )}
                    >
                      {department.name}
                    </button>
                  </li>
                );
              })}
              <li>
                <Link
                  href="/shop"
                  className="px-3 py-4 text-[13.5px] text-ink-soft transition-colors hover:text-ink"
                >
                  All
                </Link>
              </li>
            </ul>
          </nav>

          <div className="ml-auto flex items-center">
            <SearchPanel
              trigger={
                <button
                  type="button"
                  aria-label="Search"
                  className="grid h-11 w-11 place-items-center text-ink transition-colors hover:text-clay"
                >
                  <Search size={19} strokeWidth={1.5} />
                </button>
              }
            />

            <Link
              href={account ? "/account" : "/sign-in"}
              aria-label={account ? `Account — signed in as ${account.name}` : "Sign in"}
              className="hidden h-11 w-11 place-items-center text-ink transition-colors hover:text-clay sm:grid"
            >
              <User size={19} strokeWidth={1.5} />
            </Link>

            <Link
              href="/wishlist"
              aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} saved` : ""}`}
              className="relative hidden h-11 w-11 place-items-center text-ink transition-colors hover:text-clay sm:grid"
            >
              <Heart size={19} strokeWidth={1.5} />
              {wishlistCount > 0 ? <Dot>{wishlistCount}</Dot> : null}
            </Link>

            <button
              type="button"
              onClick={openDrawer}
              aria-label={`Basket${count > 0 ? `, ${count} items` : ", empty"}`}
              className="relative grid h-11 w-11 place-items-center text-ink transition-colors hover:text-clay"
            >
              <ShoppingBag size={19} strokeWidth={1.5} />
              {count > 0 ? <Dot key={count}>{count}</Dot> : null}
            </button>
          </div>
        </div>

        {active ? (
          <div
            id={`mega-${active.slug}`}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="absolute inset-x-0 top-full hidden border-b border-line bg-paper shadow-raise lg:block"
          >
            <div className="shell grid grid-cols-[1fr_320px] gap-10 py-9">
              <div>
                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-2xl">{active.name}</h2>
                  <Link
                    href={`/category/${active.slug}`}
                    className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink"
                  >
                    Shop everything
                  </Link>
                </div>
                {active.description ? (
                  <p className="mt-2 max-w-lg text-sm text-muted">{active.description}</p>
                ) : null}

                <ul className="mt-7 grid grid-cols-3 gap-x-8 gap-y-2.5">
                  {active.children.map((child) => (
                    <li key={child.slug}>
                      <Link
                        href={`/category/${child.slug}`}
                        className="group/link inline-flex items-center gap-1.5 py-1 text-[15px] text-ink-soft transition-colors hover:text-ink"
                      >
                        {child.name}
                        <ChevronRight
                          size={14}
                          strokeWidth={1.6}
                          className="-translate-x-1 opacity-0 transition-all duration-200 group-hover/link:translate-x-0 group-hover/link:opacity-60"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <Link href={`/category/${active.slug}`} className="group/feature block">
                <div className="relative aspect-4/3 overflow-hidden bg-paper-deep">
                  <ProductImage
                    src={active.imageUrl}
                    alt={active.imageAlt ?? ""}
                    sizes="320px"
                    className="transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover/feature:scale-[1.04]"
                  />
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium">
                  The {active.name.toLowerCase()} edit
                  <ChevronRight size={14} strokeWidth={1.8} />
                </p>
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <MobileNav
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        departments={departments}
        account={account}
      />
    </>
  );
}

function Dot({ children }: { children: React.ReactNode }) {
  return (
    <span className="tabular absolute top-1.5 right-1 grid h-4 min-w-4 animate-[count-pop_360ms_var(--ease-out-soft)] place-items-center bg-clay px-1 text-[10px] leading-none font-semibold text-paper motion-reduce:animate-none">
      {children}
    </span>
  );
}

function AnnouncementBar({ announcements }: { announcements: Announcement[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (announcements.length < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setInterval(() => setIndex((current) => (current + 1) % announcements.length), reduced ? 12000 : 6000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  if (announcements.length === 0) return null;
  const current = announcements[index];

  return (
    <div className="bg-ink text-paper">
      <div className="shell flex h-9 items-center justify-center gap-2 text-center text-[12px] tracking-[0.02em]">
        <p key={current.id} className="animate-[fade-in_500ms_ease-out] truncate motion-reduce:animate-none">
          {current.headline}
          {current.subtext ? <span className="ml-2 text-paper/60">{current.subtext}</span> : null}
          {current.ctaLabel && current.ctaHref ? (
            <Link href={current.ctaHref} className="ml-2.5 underline underline-offset-2 hover:text-paper/80">
              {current.ctaLabel}
            </Link>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function MobileNav({
  open,
  onOpenChange,
  departments,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  account: { name: string; isStaff: boolean } | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 data-[state=open]:animate-[fade-in_200ms_ease-out] lg:hidden"
        />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[88%] max-w-sm flex-col bg-paper data-[state=open]:animate-[slide-in-left_300ms_var(--ease-out-soft)] lg:hidden"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <Dialog.Title className="font-display text-lg">Departments</Dialog.Title>
            <Dialog.Close className="grid h-9 w-9 place-items-center text-muted" aria-label="Close menu">
              <X size={19} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Mobile">
            <ul className="divide-y divide-line">
              {departments.map((department) => {
                const isExpanded = expanded === department.slug;
                return (
                  <li key={department.slug}>
                    <div className="flex items-center">
                      <Link
                        href={`/category/${department.slug}`}
                        className="flex-1 px-3 py-4 text-[16px] text-ink"
                      >
                        {department.name}
                      </Link>
                      {department.children.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : department.slug)}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${department.name}`}
                          className="grid h-12 w-12 place-items-center text-muted"
                        >
                          <ChevronDown
                            size={18}
                            strokeWidth={1.6}
                            className={cn("transition-transform duration-300", isExpanded && "rotate-180")}
                          />
                        </button>
                      ) : null}
                    </div>
                    {isExpanded ? (
                      <ul className="pb-2 pl-3">
                        {department.children.map((child) => (
                          <li key={child.slug}>
                            <Link href={`/category/${child.slug}`} className="block px-3 py-3 text-[15px] text-ink-soft">
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-line px-5 py-4">
            <Link href={account ? "/account" : "/sign-in"} className="flex items-center gap-2.5 py-2 text-sm">
              <User size={18} strokeWidth={1.5} />
              {account ? `Hello, ${account.name.split(" ")[0]}` : "Sign in or create an account"}
            </Link>
            <Link href="/wishlist" className="flex items-center gap-2.5 py-2 text-sm">
              <Heart size={18} strokeWidth={1.5} />
              Wishlist
            </Link>
            {account?.isStaff ? (
              <Link href="/admin" className="flex items-center gap-2.5 py-2 text-sm text-clay">
                Admin dashboard
              </Link>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
