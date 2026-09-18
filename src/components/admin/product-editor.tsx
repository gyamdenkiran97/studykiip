"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { parseMoneyInput, toMoneyInput } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Panel } from "./ui";
import { saveProductAction } from "@/server/actions/admin/catalog";

/**
 * Product editor.
 *
 * Money is typed in major units and converted to integer minor units before it
 * leaves the browser; the server re-validates regardless. Variants are edited
 * inline because a product without its variants is not a sellable thing.
 */

type VariantDraft = {
  id?: string;
  sku: string;
  title: string;
  price: string;
  salePrice: string;
  costPrice: string;
  weightGrams: string;
  lowStockThreshold: string;
  allowBackorder: boolean;
  isActive: boolean;
  initialStock: string;
  stockOnHand?: number;
};

export type ProductEditorData = {
  id?: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  brandId: string | null;
  taxClassId: string | null;
  categoryIds: string[];
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isFeatured: boolean;
  tags: string[];
  metaTitle: string;
  metaDescription: string;
  variants: VariantDraft[];
  attributes: Record<string, string>;
};

export function ProductEditor({
  initial,
  brands,
  categories,
  taxClasses,
  attributeDefinitions,
}: {
  initial: ProductEditorData;
  brands: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; parentName: string | null }>;
  taxClasses: Array<{ id: string; name: string; rateBps: number }>;
  attributeDefinitions: Array<{
    key: string;
    label: string;
    type: string;
    unit: string | null;
    options: string[];
  }>;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<string | null>(null);

  function update<K extends keyof ProductEditorData>(key: K, value: ProductEditorData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(null);

    if (form.categoryIds.length === 0) {
      setErrors("Choose at least one category.");
      return;
    }

    const variants = form.variants.map((variant) => {
      const priceCents = parseMoneyInput(variant.price || "0");
      const salePriceCents = variant.salePrice ? parseMoneyInput(variant.salePrice) : null;
      const costPriceCents = variant.costPrice ? parseMoneyInput(variant.costPrice) : null;
      return {
        id: variant.id,
        sku: variant.sku.trim(),
        title: variant.title.trim() || "Standard",
        priceCents: priceCents ?? 0,
        salePriceCents,
        costPriceCents,
        weightGrams: variant.weightGrams ? Number(variant.weightGrams) : null,
        lowStockThreshold: Number(variant.lowStockThreshold || 5),
        allowBackorder: variant.allowBackorder,
        isActive: variant.isActive,
        initialStock: variant.id ? undefined : Number(variant.initialStock || 0),
      };
    });

    if (variants.some((variant) => !variant.sku)) {
      setErrors("Every variant needs a SKU.");
      return;
    }
    if (variants.some((variant) => variant.priceCents <= 0)) {
      setErrors("Every variant needs a price above zero.");
      return;
    }

    setPending(true);
    const result = await saveProductAction({
      id: form.id,
      title: form.title,
      slug: form.slug || undefined,
      shortDescription: form.shortDescription,
      description: form.description,
      brandId: form.brandId,
      taxClassId: form.taxClassId,
      categoryIds: form.categoryIds,
      status: form.status,
      isFeatured: form.isFeatured,
      tags: form.tags,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      variants,
      attributes: form.attributes,
    });
    setPending(false);

    if (!result.ok) {
      setErrors(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Product saved");
    router.push(`/admin/products/${result.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
      <div className="space-y-6">
        <Panel title="Details">
          <div className="space-y-4 px-5 py-4">
            <Field label="Title" htmlFor="title">
              <Input
                id="title"
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                required
                maxLength={200}
              />
            </Field>

            <Field label="URL slug" htmlFor="slug" hint="Leave blank to generate from the title.">
              <Input
                id="slug"
                value={form.slug}
                onChange={(event) => update("slug", event.target.value)}
                maxLength={200}
                placeholder="storm-overcoat"
              />
            </Field>

            <Field label="Short description" htmlFor="shortDescription" hint="Shown on cards and in search results.">
              <Textarea
                id="shortDescription"
                value={form.shortDescription}
                onChange={(event) => update("shortDescription", event.target.value)}
                rows={2}
                maxLength={400}
              />
            </Field>

            <Field label="Description" htmlFor="description">
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                rows={8}
                required
                maxLength={20000}
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Variants"
          description="Each variant is a sellable SKU with its own price and stock."
          actions={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                update("variants", [
                  ...form.variants,
                  {
                    sku: "",
                    title: "",
                    price: "",
                    salePrice: "",
                    costPrice: "",
                    weightGrams: "",
                    lowStockThreshold: "5",
                    allowBackorder: false,
                    isActive: true,
                    initialStock: "0",
                  },
                ])
              }
            >
              <Plus size={14} strokeWidth={2} />
              Add variant
            </Button>
          }
        >
          <ul className="divide-y divide-line">
            {form.variants.map((variant, index) => (
              <li key={variant.id ?? `new-${index}`} className="space-y-3 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
                    Variant {index + 1}
                    {variant.stockOnHand !== undefined ? (
                      <span className="ml-2 font-normal normal-case">· {variant.stockOnHand} in stock</span>
                    ) : null}
                  </p>
                  {form.variants.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          "variants",
                          form.variants.filter((_, i) => i !== index),
                        )
                      }
                      className="text-muted hover:text-danger"
                      aria-label={`Remove variant ${index + 1}`}
                    >
                      <Trash2 size={15} strokeWidth={1.6} />
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="SKU" htmlFor={`sku-${index}`}>
                    <Input
                      id={`sku-${index}`}
                      value={variant.sku}
                      onChange={(event) => updateVariant(index, { sku: event.target.value.toUpperCase() })}
                      required
                      maxLength={64}
                    />
                  </Field>
                  <Field label="Option name" htmlFor={`vtitle-${index}`} hint="e.g. Bark / M, or Standard">
                    <Input
                      id={`vtitle-${index}`}
                      value={variant.title}
                      onChange={(event) => updateVariant(index, { title: event.target.value })}
                      maxLength={160}
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Price (£)" htmlFor={`price-${index}`}>
                    <Input
                      id={`price-${index}`}
                      inputMode="decimal"
                      value={variant.price}
                      onChange={(event) => updateVariant(index, { price: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Sale price (£)" htmlFor={`sale-${index}`} hint="Blank for none">
                    <Input
                      id={`sale-${index}`}
                      inputMode="decimal"
                      value={variant.salePrice}
                      onChange={(event) => updateVariant(index, { salePrice: event.target.value })}
                    />
                  </Field>
                  <Field label="Cost (£)" htmlFor={`cost-${index}`} hint="Staff only">
                    <Input
                      id={`cost-${index}`}
                      inputMode="decimal"
                      value={variant.costPrice}
                      onChange={(event) => updateVariant(index, { costPrice: event.target.value })}
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Weight (g)" htmlFor={`weight-${index}`}>
                    <Input
                      id={`weight-${index}`}
                      inputMode="numeric"
                      value={variant.weightGrams}
                      onChange={(event) => updateVariant(index, { weightGrams: event.target.value })}
                    />
                  </Field>
                  <Field label="Low stock at" htmlFor={`threshold-${index}`}>
                    <Input
                      id={`threshold-${index}`}
                      inputMode="numeric"
                      value={variant.lowStockThreshold}
                      onChange={(event) => updateVariant(index, { lowStockThreshold: event.target.value })}
                    />
                  </Field>
                  {!variant.id ? (
                    <Field label="Opening stock" htmlFor={`stock-${index}`}>
                      <Input
                        id={`stock-${index}`}
                        inputMode="numeric"
                        value={variant.initialStock}
                        onChange={(event) => updateVariant(index, { initialStock: event.target.value })}
                      />
                    </Field>
                  ) : (
                    <div className="flex items-end">
                      <Link
                        href="/admin/inventory"
                        className="pb-3 text-[12.5px] underline underline-offset-4 hover:text-clay"
                      >
                        Adjust stock in Inventory
                      </Link>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={variant.isActive}
                      onChange={(event) => updateVariant(index, { isActive: event.target.checked })}
                      className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
                    />
                    Available to buy
                  </label>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={variant.allowBackorder}
                      onChange={(event) => updateVariant(index, { allowBackorder: event.target.checked })}
                      className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
                    />
                    Allow backorders
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {attributeDefinitions.length > 0 ? (
          <Panel title="Attributes" description="Admin-defined fields; these also power storefront filters.">
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
              {attributeDefinitions.map((definition) => (
                <Field
                  key={definition.key}
                  label={definition.unit ? `${definition.label} (${definition.unit})` : definition.label}
                  htmlFor={`attr-${definition.key}`}
                >
                  {definition.type === "SELECT" && definition.options.length > 0 ? (
                    <Select
                      id={`attr-${definition.key}`}
                      value={form.attributes[definition.key] ?? ""}
                      onChange={(event) =>
                        update("attributes", { ...form.attributes, [definition.key]: event.target.value })
                      }
                    >
                      <option value="">Not set</option>
                      {definition.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  ) : definition.type === "BOOLEAN" ? (
                    <Select
                      id={`attr-${definition.key}`}
                      value={form.attributes[definition.key] ?? ""}
                      onChange={(event) =>
                        update("attributes", { ...form.attributes, [definition.key]: event.target.value })
                      }
                    >
                      <option value="">Not set</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </Select>
                  ) : (
                    <Input
                      id={`attr-${definition.key}`}
                      value={form.attributes[definition.key] ?? ""}
                      onChange={(event) =>
                        update("attributes", { ...form.attributes, [definition.key]: event.target.value })
                      }
                      inputMode={definition.type === "NUMBER" ? "numeric" : undefined}
                      maxLength={500}
                    />
                  )}
                </Field>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel title="Search engine listing">
          <div className="space-y-4 px-5 py-4">
            <Field label="Meta title" htmlFor="metaTitle" hint="Around 60 characters reads best.">
              <Input
                id="metaTitle"
                value={form.metaTitle}
                onChange={(event) => update("metaTitle", event.target.value)}
                maxLength={200}
              />
            </Field>
            <Field label="Meta description" htmlFor="metaDescription" hint="Around 155 characters.">
              <Textarea
                id="metaDescription"
                value={form.metaDescription}
                onChange={(event) => update("metaDescription", event.target.value)}
                rows={3}
                maxLength={400}
              />
            </Field>
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Publication">
          <div className="space-y-4 px-5 py-4">
            <Field label="Status" htmlFor="status">
              <Select
                id="status"
                value={form.status}
                onChange={(event) => update("status", event.target.value as ProductEditorData["status"])}
              >
                <option value="DRAFT">Draft — not visible in the store</option>
                <option value="ACTIVE">Active — on sale</option>
                <option value="ARCHIVED">Archived — hidden, history kept</option>
              </Select>
            </Field>

            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(event) => update("isFeatured", event.target.checked)}
                className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
              />
              Feature on the homepage
            </label>

            {errors ? (
              <p role="alert" className="text-[13px] text-danger">
                {errors}
              </p>
            ) : null}

            <Button type="submit" full disabled={pending}>
              {pending ? "Saving…" : form.id ? "Save changes" : "Create product"}
            </Button>
          </div>
        </Panel>

        <Panel title="Organisation">
          <div className="space-y-4 px-5 py-4">
            <Field label="Brand" htmlFor="brandId">
              <Select
                id="brandId"
                value={form.brandId ?? ""}
                onChange={(event) => update("brandId", event.target.value || null)}
              >
                <option value="">No brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </Select>
            </Field>

            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-soft">
                Categories <span className="text-muted">(first is primary)</span>
              </legend>
              <div className="max-h-56 space-y-1 overflow-y-auto border border-line p-2">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-2 py-0.5 text-[13px]">
                    <input
                      type="checkbox"
                      checked={form.categoryIds.includes(category.id)}
                      onChange={(event) =>
                        update(
                          "categoryIds",
                          event.target.checked
                            ? [...form.categoryIds, category.id]
                            : form.categoryIds.filter((id) => id !== category.id),
                        )
                      }
                      className="h-4 w-4 shrink-0 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
                    />
                    <span className={category.parentName ? "text-ink-soft" : "font-medium"}>
                      {category.parentName ? `${category.parentName} → ${category.name}` : category.name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Field label="Tax class" htmlFor="taxClassId">
              <Select
                id="taxClassId"
                value={form.taxClassId ?? ""}
                onChange={(event) => update("taxClassId", event.target.value || null)}
              >
                <option value="">Store default</option>
                {taxClasses.map((taxClass) => (
                  <option key={taxClass.id} value={taxClass.id}>
                    {taxClass.name} ({(taxClass.rateBps / 100).toFixed(0)}%)
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Tags" htmlFor="tags" hint="Comma separated. Used by search.">
              <Input
                id="tags"
                value={form.tags.join(", ")}
                onChange={(event) =>
                  update(
                    "tags",
                    event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                      .slice(0, 20),
                  )
                }
              />
            </Field>
          </div>
        </Panel>
      </div>
    </form>
  );
}

/** Formats stored minor units for the editor's text inputs. */
export function centsToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : toMoneyInput(value);
}
