"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as Accordion from "@radix-ui/react-accordion";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { SORT_OPTIONS, type CatalogFacets, type SortKey } from "@/server/catalog/types";

/**
 * Filtering and sorting.
 *
 * All state lives in the URL, so every filtered view is linkable and the back
 * button behaves. Desktop shows a persistent rail; touch gets a full-height
 * drawer with the apply action fixed at the bottom, within thumb reach.
 */

type FilterState = {
  brand: string[];
  min?: number;
  max?: number;
  rating?: number;
  stock: boolean;
  sale: boolean;
  attributes: Record<string, string[]>;
};

function readState(params: URLSearchParams): FilterState {
  const attributes: Record<string, string[]> = {};
  for (const [key, value] of params.entries()) {
    if (key.startsWith("attr_")) {
      attributes[key.slice(5)] = value.split(",").filter(Boolean);
    }
  }
  return {
    brand: params.get("brand")?.split(",").filter(Boolean) ?? [],
    min: params.get("min") ? Number(params.get("min")) : undefined,
    max: params.get("max") ? Number(params.get("max")) : undefined,
    rating: params.get("rating") ? Number(params.get("rating")) : undefined,
    stock: params.get("stock") === "1",
    sale: params.get("sale") === "1",
    attributes,
  };
}

function useFilterNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page"); // any filter change returns to the first page
      startTransition(() => {
        router.push(`${pathname}${params.toString() ? `?${params}` : ""}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return { apply, pending, searchParams };
}

export function SortSelect({ value }: { value: SortKey }) {
  const { apply, pending } = useFilterNavigation();

  return (
    <label className="flex items-center gap-2 text-[13px] text-muted">
      <span className="hidden sm:inline">Sort</span>
      <select
        value={value}
        disabled={pending}
        onChange={(event) => apply((params) => params.set("sort", event.target.value))}
        className="h-9 cursor-pointer appearance-none border-0 bg-transparent py-0 pr-5 pl-1 text-[13px] font-medium text-ink focus:outline-none"
        aria-label="Sort products"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ActiveFilterChips({ facets }: { facets: CatalogFacets }) {
  const { apply, searchParams } = useFilterNavigation();
  const state = useMemo(() => readState(new URLSearchParams(searchParams.toString())), [searchParams]);

  const chips: Array<{ label: string; clear: (params: URLSearchParams) => void }> = [];

  for (const slug of state.brand) {
    const brand = facets.brands.find((entry) => entry.value === slug);
    chips.push({
      label: brand?.label ?? slug,
      clear: (params) => {
        const next = state.brand.filter((entry) => entry !== slug);
        if (next.length) params.set("brand", next.join(","));
        else params.delete("brand");
      },
    });
  }

  if (state.min !== undefined || state.max !== undefined) {
    chips.push({
      label: `${state.min !== undefined ? formatMoney(state.min * 100) : "Any"} – ${
        state.max !== undefined ? formatMoney(state.max * 100) : "Any"
      }`,
      clear: (params) => {
        params.delete("min");
        params.delete("max");
      },
    });
  }

  if (state.rating) {
    chips.push({ label: `${state.rating}★ and up`, clear: (params) => params.delete("rating") });
  }
  if (state.stock) chips.push({ label: "In stock", clear: (params) => params.delete("stock") });
  if (state.sale) chips.push({ label: "On sale", clear: (params) => params.delete("sale") });

  for (const [key, values] of Object.entries(state.attributes)) {
    const group = facets.attributes.find((entry) => entry.key === key);
    for (const value of values) {
      chips.push({
        label: `${group?.label ?? key}: ${value}`,
        clear: (params) => {
          const next = values.filter((entry) => entry !== value);
          if (next.length) params.set(`attr_${key}`, next.join(","));
          else params.delete(`attr_${key}`);
        },
      });
    }
  }

  if (chips.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.label}>
          <button
            type="button"
            onClick={() => apply(chip.clear)}
            className="inline-flex items-center gap-1.5 border border-line-strong bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            {chip.label}
            <X size={13} strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">Remove filter</span>
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={() =>
            apply((params) => {
              for (const key of [...params.keys()]) {
                if (key !== "q" && key !== "sort") params.delete(key);
              }
            })
          }
          className="px-1 text-[12.5px] text-muted underline underline-offset-4 hover:text-ink"
        >
          Clear all
        </button>
      </li>
    </ul>
  );
}

function FilterSections({ facets }: { facets: CatalogFacets }) {
  const { apply, searchParams } = useFilterNavigation();
  const urlState = useMemo(() => readState(new URLSearchParams(searchParams.toString())), [searchParams]);

  // The URL is the source of truth, but navigation is asynchronous. Mirroring
  // it in local state lets a checkbox respond to the click immediately instead
  // of appearing stuck until the new page arrives.
  const [state, setState] = useState(urlState);
  useEffect(() => setState(urlState), [urlState]);

  const [minInput, setMinInput] = useState(urlState.min?.toString() ?? "");
  const [maxInput, setMaxInput] = useState(urlState.max?.toString() ?? "");

  const toggleMulti = (paramKey: string, current: string[], value: string) => {
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];

    setState((draft) =>
      paramKey === "brand"
        ? { ...draft, brand: next }
        : { ...draft, attributes: { ...draft.attributes, [paramKey.replace("attr_", "")]: next } },
    );

    apply((params) => {
      if (next.length) params.set(paramKey, next.join(","));
      else params.delete(paramKey);
    });
  };

  const sections = [
    facets.availability.inStock > 0 || facets.availability.onSale > 0 ? (
      <Section key="availability" value="availability" title="Availability">
        <CheckRow
          label="In stock only"
          count={facets.availability.inStock}
          checked={state.stock}
          onChange={() => {
            const next = !state.stock;
            setState((draft) => ({ ...draft, stock: next }));
            apply((params) => (next ? params.set("stock", "1") : params.delete("stock")));
          }}
        />
        <CheckRow
          label="On sale"
          count={facets.availability.onSale}
          checked={state.sale}
          onChange={() => {
            const next = !state.sale;
            setState((draft) => ({ ...draft, sale: next }));
            apply((params) => (next ? params.set("sale", "1") : params.delete("sale")));
          }}
        />
      </Section>
    ) : null,

    <Section key="price" value="price" title="Price">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="filter-min">
          Minimum price
        </label>
        <input
          id="filter-min"
          inputMode="numeric"
          value={minInput}
          onChange={(event) => setMinInput(event.target.value.replace(/\D/g, ""))}
          placeholder={String(Math.floor(facets.priceRange.minCents / 100))}
          className="h-9 w-full border border-line-strong bg-surface px-2.5 text-[13px] focus:border-ink focus:outline-none"
        />
        <span className="text-muted" aria-hidden="true">
          –
        </span>
        <label className="sr-only" htmlFor="filter-max">
          Maximum price
        </label>
        <input
          id="filter-max"
          inputMode="numeric"
          value={maxInput}
          onChange={(event) => setMaxInput(event.target.value.replace(/\D/g, ""))}
          placeholder={String(Math.ceil(facets.priceRange.maxCents / 100))}
          className="h-9 w-full border border-line-strong bg-surface px-2.5 text-[13px] focus:border-ink focus:outline-none"
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() =>
          apply((params) => {
            if (minInput) params.set("min", minInput);
            else params.delete("min");
            if (maxInput) params.set("max", maxInput);
            else params.delete("max");
          })
        }
      >
        Apply price
      </Button>
    </Section>,

    facets.brands.length > 1 ? (
      <Section key="brand" value="brand" title="Brand">
        {facets.brands.map((brand) => (
          <CheckRow
            key={brand.value}
            label={brand.label}
            count={brand.count}
            checked={state.brand.includes(brand.value)}
            onChange={() => toggleMulti("brand", state.brand, brand.value)}
          />
        ))}
      </Section>
    ) : null,

    <Section key="rating" value="rating" title="Rating">
      {[4, 3, 2].map((rating) => (
        <CheckRow
          key={rating}
          label={`${rating}★ and up`}
          checked={state.rating === rating}
          onChange={() => {
            const next = state.rating === rating ? undefined : rating;
            setState((draft) => ({ ...draft, rating: next }));
            apply((params) =>
              next === undefined ? params.delete("rating") : params.set("rating", String(next)),
            );
          }}
        />
      ))}
    </Section>,

    ...facets.attributes.map((group) => (
      <Section key={group.key} value={group.key} title={group.label}>
        {group.values.map((entry) => (
          <CheckRow
            key={entry.value}
            label={entry.label}
            count={entry.count}
            checked={(state.attributes[group.key] ?? []).includes(entry.value)}
            onChange={() =>
              toggleMulti(`attr_${group.key}`, state.attributes[group.key] ?? [], entry.value)
            }
          />
        ))}
      </Section>
    )),
  ].filter(Boolean);

  return (
    <Accordion.Root
      type="multiple"
      defaultValue={["availability", "price", "brand"]}
      className="divide-y divide-line border-y border-line"
    >
      {sections}
    </Accordion.Root>
  );
}

function Section({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Item value={value}>
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center justify-between py-3.5 text-left text-[13.5px] font-medium">
          {title}
          <ChevronDown
            size={16}
            strokeWidth={1.6}
            className="text-muted transition-transform duration-300 group-data-[state=open]:rotate-180"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden data-[state=closed]:animate-[fade-out_140ms_ease-in] data-[state=open]:animate-[fade-in_200ms_ease-out]">
        <div className="space-y-1 pb-4">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13.5px] text-ink-soft hover:text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 appearance-none border border-line-strong bg-surface transition-colors checked:border-ink checked:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      />
      <span className="flex-1">{label}</span>
      {typeof count === "number" ? <span className="tabular text-[12px] text-muted-soft">{count}</span> : null}
    </label>
  );
}

export function FilterRail({ facets }: { facets: CatalogFacets }) {
  return (
    <aside aria-label="Filters" className="hidden lg:block">
      <FilterSections facets={facets} />
    </aside>
  );
}

export function FilterDrawer({ facets, activeCount }: { facets: CatalogFacets; activeCount: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <SlidersHorizontal size={15} strokeWidth={1.7} />
          Filter
          {activeCount > 0 ? (
            <span className="tabular ml-0.5 grid h-4.5 min-w-4.5 place-items-center bg-ink px-1 text-[10px] text-paper">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 data-[state=open]:animate-[fade-in_200ms_ease-out] lg:hidden"
        />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col bg-paper data-[state=open]:animate-[slide-up-sheet_300ms_var(--ease-out-soft)] lg:hidden"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <Dialog.Title className="font-display text-lg">Filter</Dialog.Title>
            <Dialog.Close className="grid h-9 w-9 place-items-center text-muted" aria-label="Close filters">
              <X size={19} strokeWidth={1.5} />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <FilterSections facets={facets} />
          </div>
          <div className="border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button full size="lg" onClick={() => setOpen(false)}>
              Show results
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
