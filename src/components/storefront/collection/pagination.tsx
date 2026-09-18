"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Pagination as real links (crawlable, middle-clickable) rather than buttons.
 * Long ranges collapse around the current page.
 */
export function Pagination({ page, pageCount, total }: { page: number; pageCount: number; total: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    return `${pathname}${params.toString() ? `?${params}` : ""}`;
  };

  const pages = pageRange(page, pageCount);

  return (
    <nav aria-label="Pagination" className="mt-14 flex flex-col items-center gap-3">
      <ul className="flex items-center gap-1">
        <li>
          <PageLink href={href(page - 1)} disabled={page <= 1} label="Previous page">
            <ChevronLeft size={16} strokeWidth={1.7} />
          </PageLink>
        </li>
        {pages.map((entry, index) =>
          entry === "gap" ? (
            <li key={`gap-${index}`} className="px-2 text-muted-soft" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={entry}>
              <PageLink href={href(entry)} current={entry === page} label={`Page ${entry}`}>
                {entry}
              </PageLink>
            </li>
          ),
        )}
        <li>
          <PageLink href={href(page + 1)} disabled={page >= pageCount} label="Next page">
            <ChevronRight size={16} strokeWidth={1.7} />
          </PageLink>
        </li>
      </ul>
      <p className="tabular text-[12px] text-muted">
        Page {page} of {pageCount} · {total} products
      </p>
    </nav>
  );
}

function PageLink({
  href,
  children,
  current,
  disabled,
  label,
}: {
  href: string;
  children: React.ReactNode;
  current?: boolean;
  disabled?: boolean;
  label: string;
}) {
  const className = cn(
    "tabular grid h-9 min-w-9 place-items-center px-2 text-[13px] transition-colors",
    current ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep hover:text-ink",
    disabled && "pointer-events-none opacity-35",
  );

  if (disabled) {
    return (
      <span className={className} aria-hidden="true">
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className} aria-label={label} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

function pageRange(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages: Array<number | "gap"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) pages.push("gap");
  for (let index = start; index <= end; index += 1) pages.push(index);
  if (end < pageCount - 1) pages.push("gap");
  pages.push(pageCount);
  return pages;
}
