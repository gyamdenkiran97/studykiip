"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Panel, Table, Td, Th } from "./ui";
import { deleteCategoryAction, saveCategoryAction } from "@/server/actions/admin/catalog";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  position: number;
  isActive: boolean;
  isFeatured: boolean;
  imageUrl: string;
  metaTitle: string;
  metaDescription: string;
  productCount: number;
  childCount: number;
};

/** Category tree with an inline editor. Deletion is refused when in use. */
export function CategoryManager({
  categories,
  canWrite,
}: {
  categories: CategoryRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);

  const roots = categories.filter((category) => category.parentId === null);
  const childrenOf = (id: string) => categories.filter((category) => category.parentId === id);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);

    const result = await saveCategoryAction({
      id: editing?.id,
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? "") || undefined,
      description: String(formData.get("description") ?? ""),
      parentId: String(formData.get("parentId") ?? "") || null,
      position: Number(formData.get("position") ?? 0),
      isActive: formData.get("isActive") === "on",
      isFeatured: formData.get("isFeatured") === "on",
      imageUrl: String(formData.get("imageUrl") ?? ""),
      metaTitle: String(formData.get("metaTitle") ?? ""),
      metaDescription: String(formData.get("metaDescription") ?? ""),
    });

    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Category saved");
    setEditing(null);
    setCreating(false);
    router.refresh();
  }

  async function remove(category: CategoryRow) {
    const result = await deleteCategoryAction({ categoryId: category.id });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Category deleted");
    router.refresh();
  }

  if (canWrite && (editing || creating)) {
    return (
      <Panel title={editing ? `Edit ${editing.name}` : "New category"}>
        <form onSubmit={save} className="grid gap-4 px-5 py-5 lg:grid-cols-2">
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" required defaultValue={editing?.name} maxLength={120} />
          </Field>
          <Field label="Slug" htmlFor="slug" hint="Leave blank to generate from the name.">
            <Input id="slug" name="slug" defaultValue={editing?.slug} maxLength={120} />
          </Field>

          <Field label="Parent" htmlFor="parentId" className="lg:col-span-2">
            <Select id="parentId" name="parentId" defaultValue={editing?.parentId ?? ""}>
              <option value="">Top level (a department)</option>
              {categories
                .filter((category) => category.id !== editing?.id && category.parentId === null)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="Description" htmlFor="description" className="lg:col-span-2">
            <Textarea id="description" name="description" rows={2} defaultValue={editing?.description} maxLength={1000} />
          </Field>

          <Field label="Image URL" htmlFor="imageUrl">
            <Input id="imageUrl" name="imageUrl" defaultValue={editing?.imageUrl} maxLength={500} />
          </Field>
          <Field label="Position" htmlFor="position" hint="Lower numbers come first.">
            <Input id="position" name="position" inputMode="numeric" defaultValue={editing?.position ?? 0} />
          </Field>

          <Field label="Meta title" htmlFor="metaTitle">
            <Input id="metaTitle" name="metaTitle" defaultValue={editing?.metaTitle} maxLength={200} />
          </Field>
          <Field label="Meta description" htmlFor="metaDescription">
            <Input id="metaDescription" name="metaDescription" defaultValue={editing?.metaDescription} maxLength={400} />
          </Field>

          <div className="flex flex-wrap gap-5 lg:col-span-2">
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editing?.isActive ?? true}
                className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
              />
              Visible in the store
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                name="isFeatured"
                defaultChecked={editing?.isFeatured ?? false}
                className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
              />
              Feature on the homepage
            </label>
          </div>

          <div className="flex gap-2 lg:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save category"}
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
      title="Tree"
      actions={
        canWrite ? (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus size={14} strokeWidth={2} />
            New category
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
            <Th align="center">Position</Th>
            <Th>Status</Th>
            {canWrite ? <Th align="right">Actions</Th> : null}
          </tr>
        </thead>
        <tbody>
          {roots.flatMap((root) => [
            <CategoryRowView
              key={root.id}
              category={root}
              depth={0}
              canWrite={canWrite}
              onEdit={setEditing}
              onDelete={remove}
            />,
            ...childrenOf(root.id).map((child) => (
              <CategoryRowView
                key={child.id}
                category={child}
                depth={1}
                canWrite={canWrite}
                onEdit={setEditing}
                onDelete={remove}
              />
            )),
          ])}
        </tbody>
      </Table>
    </Panel>
  );
}

function CategoryRowView({
  category,
  depth,
  canWrite,
  onEdit,
  onDelete,
}: {
  category: CategoryRow;
  depth: number;
  canWrite: boolean;
  onEdit: (category: CategoryRow) => void;
  onDelete: (category: CategoryRow) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <tr className="hover:bg-paper-deep">
      <Td>
        <span className="flex items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>
          {depth > 0 ? (
            <ChevronRight size={13} strokeWidth={1.6} className="text-muted-soft" aria-hidden="true" />
          ) : null}
          <span className={depth === 0 ? "font-medium" : ""}>{category.name}</span>
          {category.isFeatured ? <Badge tone="quiet">Featured</Badge> : null}
        </span>
      </Td>
      <Td className="font-mono text-[11.5px] text-muted">{category.slug}</Td>
      <Td align="center" className="tabular">
        {category.productCount}
      </Td>
      <Td align="center" className="tabular text-muted">
        {category.position}
      </Td>
      <Td>
        <Badge tone={category.isActive ? "success" : "out"}>{category.isActive ? "active" : "hidden"}</Badge>
      </Td>
      {canWrite ? (
        <Td align="right">
          {confirming ? (
            <span className="flex justify-end gap-2 text-[12px]">
              <button type="button" className="text-danger hover:underline" onClick={() => onDelete(category)}>
                Confirm
              </button>
              <button type="button" className="text-muted hover:underline" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <span className="flex justify-end gap-3 text-[12px]">
              <button type="button" className="text-muted hover:text-ink" onClick={() => onEdit(category)}>
                Edit
              </button>
              <button type="button" className="text-muted hover:text-danger" onClick={() => setConfirming(true)}>
                Delete
              </button>
            </span>
          )}
        </Td>
      ) : null}
    </tr>
  );
}
