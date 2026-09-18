"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Panel, Table, Td, Th } from "./ui";
import { saveBrandAction } from "@/server/actions/admin/catalog";

type BrandRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  websiteUrl: string;
  isFeatured: boolean;
  isActive: boolean;
  productCount: number;
};

export function BrandManager({ brands, canWrite }: { brands: BrandRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);

    const result = await saveBrandAction({
      id: editing?.id,
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? "") || undefined,
      description: String(formData.get("description") ?? ""),
      websiteUrl: String(formData.get("websiteUrl") ?? ""),
      isFeatured: formData.get("isFeatured") === "on",
      isActive: formData.get("isActive") === "on",
    });

    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Brand saved");
    setEditing(null);
    setCreating(false);
    router.refresh();
  }

  if (canWrite && (editing || creating)) {
    return (
      <Panel title={editing ? `Edit ${editing.name}` : "New brand"}>
        <form onSubmit={save} className="grid max-w-2xl gap-4 px-5 py-5">
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" required defaultValue={editing?.name} maxLength={120} />
          </Field>
          <Field label="Slug" htmlFor="slug" hint="Leave blank to generate from the name.">
            <Input id="slug" name="slug" defaultValue={editing?.slug} maxLength={120} />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" rows={3} defaultValue={editing?.description} maxLength={1000} />
          </Field>
          <Field label="Website" htmlFor="websiteUrl">
            <Input id="websiteUrl" name="websiteUrl" type="url" defaultValue={editing?.websiteUrl} maxLength={300} />
          </Field>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editing?.isActive ?? true}
                className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                name="isFeatured"
                defaultChecked={editing?.isFeatured ?? false}
                className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
              />
              Featured
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save brand"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Panel>
    );
  }

  return (
    <Panel
      title={`${brands.length} brands`}
      actions={
        canWrite ? (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus size={14} strokeWidth={2} />
            New brand
          </Button>
        ) : null
      }
    >
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Slug</Th>
            <Th align="center">Products</Th>
            <Th>Status</Th>
            {canWrite ? <Th align="right">Actions</Th> : null}
          </tr>
        </thead>
        <tbody>
          {brands.map((brand) => (
            <tr key={brand.id} className="hover:bg-paper-deep">
              <Td>
                <span className="font-medium">{brand.name}</span>
                {brand.isFeatured ? <Badge tone="quiet" className="ml-2">Featured</Badge> : null}
                {brand.description ? (
                  <span className="mt-0.5 block max-w-md truncate text-[11.5px] text-muted">{brand.description}</span>
                ) : null}
              </Td>
              <Td className="font-mono text-[11.5px] text-muted">
                <Link href={`/brand/${brand.slug}`} className="hover:underline">
                  {brand.slug}
                </Link>
              </Td>
              <Td align="center" className="tabular">
                {brand.productCount}
              </Td>
              <Td>
                <Badge tone={brand.isActive ? "success" : "out"}>{brand.isActive ? "active" : "hidden"}</Badge>
              </Td>
              {canWrite ? (
                <Td align="right">
                  <button
                    type="button"
                    className="text-[12px] text-muted hover:text-ink"
                    onClick={() => setEditing(brand)}
                  >
                    Edit
                  </button>
                </Td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}
