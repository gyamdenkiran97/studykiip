"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";

/**
 * Admin list filters. State lives in the URL so a filtered list can be shared
 * with a colleague or bookmarked for a recurring task.
 */
export function AdminFilters({
  searchPlaceholder = "Search",
  filters = [],
}: {
  searchPlaceholder?: string;
  filters?: Array<{ key: string; label: string; options: Array<{ value: string; label: string }> }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function apply(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    startTransition(() => router.push(`${pathname}${params.toString() ? `?${params}` : ""}`));
  }

  const hasFilters = [...searchParams.keys()].some((key) => key !== "page");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply((params) => (query ? params.set("q", query) : params.delete("q")));
        }}
        className="relative"
        role="search"
      >
        <Search
          size={15}
          strokeWidth={1.7}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-9 w-64 border border-line-strong bg-surface pr-3 pl-9 text-[13px] focus:border-ink focus:outline-none"
        />
      </form>

      {filters.map((filter) => (
        <label key={filter.key} className="sr-only-label">
          <span className="sr-only">{filter.label}</span>
          <select
            value={searchParams.get(filter.key) ?? ""}
            onChange={(event) =>
              apply((params) =>
                event.target.value ? params.set(filter.key, event.target.value) : params.delete(filter.key),
              )
            }
            disabled={pending}
            className="h-9 border border-line-strong bg-surface px-3 text-[13px] focus:border-ink focus:outline-none"
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {hasFilters ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            startTransition(() => router.push(pathname));
          }}
          className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink"
        >
          <X size={13} strokeWidth={1.8} />
          Clear
        </button>
      ) : null}
    </div>
  );
}
