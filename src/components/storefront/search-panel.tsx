"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, ArrowRight } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";
import { ProductImage } from "@/components/ui/product-image";
import type { Suggestion } from "@/server/search/engine";

const RECENT_KEY = "kiip:recent-searches";

/** Search overlay with debounced typeahead across products, brands and departments. */
export function SearchPanel({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 5));
    } catch {
      setRecent([]);
    }
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (response.ok) setSuggestions((await response.json()).suggestions ?? []);
      } catch {
        // Aborted or offline: leave the previous suggestions in place.
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function submit(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
      const next = [trimmed, ...recent.filter((entry) => entry !== trimmed)].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Private browsing: recent searches are a nicety, not a requirement.
    }
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  const grouped = {
    departments: suggestions.filter((item) => item.type === "category"),
    brands: suggestions.filter((item) => item.type === "brand"),
    products: suggestions.filter((item) => item.type === "product"),
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 data-[state=open]:animate-[fade-in_200ms_ease-out]"
        />
        <Dialog.Content
          className="fixed inset-x-0 top-0 z-50 border-b border-line bg-paper data-[state=open]:animate-[slide-down_260ms_var(--ease-out-soft)]"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">Search Kiip Mall</Dialog.Title>
          <Dialog.Description className="sr-only">
            Type at least two characters to see product, brand and department suggestions.
          </Dialog.Description>

          <div className="shell py-5">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit(query);
              }}
              className="flex items-center gap-3 border-b border-line-strong pb-3"
              role="search"
            >
              <Search size={20} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, brands and departments"
                aria-label="Search products, brands and departments"
                autoComplete="off"
                className="h-9 w-full bg-transparent font-display text-xl text-ink placeholder:font-sans placeholder:text-[16px] placeholder:text-muted-soft focus:outline-none"
              />
              <Dialog.Close
                className="grid h-9 w-9 shrink-0 place-items-center text-muted hover:text-ink"
                aria-label="Close search"
              >
                <X size={19} strokeWidth={1.5} />
              </Dialog.Close>
            </form>

            <div className="max-h-[60vh] overflow-y-auto pt-5" aria-live="polite" aria-busy={loading}>
              {query.trim().length < 2 ? (
                <div className="pb-4">
                  {recent.length > 0 ? (
                    <>
                      <p className="eyebrow mb-3">Recent searches</p>
                      <ul className="flex flex-wrap gap-2">
                        {recent.map((term) => (
                          <li key={term}>
                            <button
                              type="button"
                              onClick={() => submit(term)}
                              className="rounded-xs border border-line-strong px-3 py-1.5 text-[13px] text-ink-soft hover:border-ink hover:text-ink"
                            >
                              {term}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-sm text-muted">
                      Try “wool coat”, “headphones”, or a brand you already know.
                    </p>
                  )}
                </div>
              ) : suggestions.length === 0 && !loading ? (
                <div className="pb-6">
                  <p className="font-display text-lg text-ink">No matches for “{query.trim()}”</p>
                  <p className="mt-1.5 text-sm text-muted">
                    Check the spelling, or{" "}
                    <Link href="/shop" className="underline underline-offset-4" onClick={() => setOpen(false)}>
                      browse the whole mall
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="grid gap-8 pb-4 md:grid-cols-[minmax(0,260px)_1fr]">
                  <div className="space-y-6">
                    <SuggestionList title="Departments" items={grouped.departments} onNavigate={() => setOpen(false)} />
                    <SuggestionList title="Brands" items={grouped.brands} onNavigate={() => setOpen(false)} />
                  </div>
                  {grouped.products.length > 0 ? (
                    <div>
                      <p className="eyebrow mb-3">Products</p>
                      <ul className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                        {grouped.products.map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className="flex items-center gap-3 rounded-xs p-1.5 hover:bg-paper-deep"
                            >
                              <span className="relative block h-14 w-12 shrink-0 overflow-hidden bg-paper-deep">
                                <ProductImage src={item.imageUrl} alt="" sizes="48px" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm text-ink">{item.label}</span>
                                {item.sublabel ? (
                                  <span className="block truncate text-[12px] text-muted">{item.sublabel}</span>
                                ) : null}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => submit(query)}
                        className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                      >
                        See all results for “{query.trim()}”
                        <ArrowRight size={14} strokeWidth={1.8} />
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SuggestionList({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: Suggestion[];
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="eyebrow mb-2.5">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn("block rounded-xs px-2 py-1.5 text-sm text-ink hover:bg-paper-deep")}
            >
              {item.label}
              {item.sublabel ? <span className="ml-2 text-[12px] text-muted">{item.sublabel}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
