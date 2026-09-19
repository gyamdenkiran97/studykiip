"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Percent,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { signOut } from "@/lib/auth-client";
import { ROLE_LABELS, type Permission, type Role } from "@/server/auth/permissions";

/**
 * Admin chrome.
 *
 * A dense, quiet interface — this is a tool, not a storefront. Navigation is
 * filtered by the signed-in user's permissions so staff do not see doors they
 * cannot open (the server refuses them regardless).
 */

type NavItem = { href: string; label: string; icon: React.ReactNode; permission: Permission };

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={16} strokeWidth={1.6} />, permission: "dashboard:read" },
    ],
  },
  {
    group: "Selling",
    items: [
      { href: "/admin/orders", label: "Orders", icon: <ShoppingCart size={16} strokeWidth={1.6} />, permission: "order:read" },
      { href: "/admin/payments", label: "Payments", icon: <CreditCard size={16} strokeWidth={1.6} />, permission: "payment:read" },
      { href: "/admin/customers", label: "Customers", icon: <Users size={16} strokeWidth={1.6} />, permission: "customer:read" },
    ],
  },
  {
    group: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: <Package size={16} strokeWidth={1.6} />, permission: "product:read" },
      { href: "/admin/categories", label: "Categories", icon: <Tags size={16} strokeWidth={1.6} />, permission: "product:read" },
      { href: "/admin/brands", label: "Brands", icon: <Store size={16} strokeWidth={1.6} />, permission: "product:read" },
      { href: "/admin/inventory", label: "Inventory", icon: <Boxes size={16} strokeWidth={1.6} />, permission: "inventory:read" },
      { href: "/admin/reviews", label: "Reviews", icon: <MessageSquare size={16} strokeWidth={1.6} />, permission: "review:moderate" },
    ],
  },
  {
    group: "Marketing",
    items: [
      { href: "/admin/promotions", label: "Promotions", icon: <Percent size={16} strokeWidth={1.6} />, permission: "promotion:write" },
      { href: "/admin/content", label: "Storefront content", icon: <FileText size={16} strokeWidth={1.6} />, permission: "content:write" },
      { href: "/admin/search", label: "Search insights", icon: <BarChart3 size={16} strokeWidth={1.6} />, permission: "dashboard:read" },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/admin/settings", label: "Settings", icon: <Settings size={16} strokeWidth={1.6} />, permission: "settings:write" },
      { href: "/admin/audit", label: "Audit log", icon: <ClipboardList size={16} strokeWidth={1.6} />, permission: "audit:read" },
    ],
  },
];

export function AdminShell({
  actor,
  permissions,
  children,
}: {
  actor: { name: string; email: string; role: Role };
  permissions: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const granted = new Set(permissions);

  const nav = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => granted.has(item.permission)),
  })).filter((group) => group.items.length > 0);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link href="/admin" className="flex items-baseline gap-2">
          <span className="font-display text-xl leading-none font-semibold tracking-[-0.04em]">Kwidus21</span>
          <span className="text-[10px] tracking-[0.22em] text-muted uppercase">Admin</span>
        </Link>
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 pb-4">
        {nav.map((group) => (
          <div key={group.group} className="mb-5">
            <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-[0.16em] text-muted-soft uppercase">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xs px-2 py-2 text-[13.5px] transition-colors",
                        active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep",
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-5 py-4">
        <p className="truncate text-[13px] font-medium">{actor.name}</p>
        <p className="truncate text-[11.5px] text-muted">{ROLE_LABELS[actor.role]}</p>
        <div className="mt-3 flex items-center gap-3">
          <Link href="/" className="text-[12.5px] text-muted hover:text-ink">
            View store
          </Link>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/");
              router.refresh();
            }}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink"
          >
            <LogOut size={13} strokeWidth={1.7} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-paper">
      <div className="lg:grid lg:grid-cols-[236px_1fr]">
        <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block">{sidebar}</aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open admin menu"
              className="grid h-9 w-9 place-items-center"
            >
              <Menu size={19} strokeWidth={1.6} />
            </button>
            <span className="font-display text-lg">Kwidus21 Admin</span>
          </header>

          {mobileOpen ? (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="absolute inset-0 bg-ink/40"
              />
              <div className="absolute inset-y-0 left-0 w-72 bg-surface">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="absolute top-4 right-3 grid h-9 w-9 place-items-center text-muted"
                >
                  <X size={18} strokeWidth={1.6} />
                </button>
                {sidebar}
              </div>
            </div>
          ) : null}

          <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
