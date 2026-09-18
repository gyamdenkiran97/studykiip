"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { deleteProductAction, duplicateProductAction, setProductStatusAction } from "@/server/actions/admin/catalog";

/** Row-level product operations. Destructive ones ask first. */
export function ProductRowActions({
  productId,
  slug,
  status,
}: {
  productId: string;
  slug: string;
  status: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function run(operation: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    const result = await operation();
    if (!result.ok) {
      toast.error(result.message ?? "That did not work.");
      return;
    }
    toast.success(success);
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="flex items-center justify-end gap-2 text-[12.5px]">
        <button
          type="button"
          className="text-danger hover:underline"
          onClick={async () => {
            setConfirming(false);
            const result = await deleteProductAction({ productId });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(
              result.data.deleted
                ? "Product deleted"
                : "Product archived — it has order history, so it cannot be deleted",
            );
            router.refresh();
          }}
        >
          Confirm
        </button>
        <button type="button" className="text-muted hover:underline" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="grid h-8 w-8 place-items-center text-muted hover:text-ink"
        aria-label="Product actions"
      >
        <MoreHorizontal size={16} strokeWidth={1.8} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-44 border border-line bg-surface py-1 shadow-raise"
        >
          <DropdownMenu.Item asChild>
            <Link href={`/admin/products/${productId}`} className="block px-3 py-1.5 text-[13px] hover:bg-paper-deep">
              Edit
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href={`/product/${slug}`} className="block px-3 py-1.5 text-[13px] hover:bg-paper-deep">
              View in store
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="cursor-pointer px-3 py-1.5 text-[13px] outline-none hover:bg-paper-deep"
            onSelect={() => run(() => duplicateProductAction({ productId }), "Product duplicated as a draft")}
          >
            Duplicate
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          {status !== "ACTIVE" ? (
            <DropdownMenu.Item
              className="cursor-pointer px-3 py-1.5 text-[13px] outline-none hover:bg-paper-deep"
              onSelect={() => run(() => setProductStatusAction({ productId, status: "ACTIVE" }), "Product published")}
            >
              Publish
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item
              className="cursor-pointer px-3 py-1.5 text-[13px] outline-none hover:bg-paper-deep"
              onSelect={() => run(() => setProductStatusAction({ productId, status: "DRAFT" }), "Product unpublished")}
            >
              Unpublish
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            className="cursor-pointer px-3 py-1.5 text-[13px] outline-none hover:bg-paper-deep"
            onSelect={() => run(() => setProductStatusAction({ productId, status: "ARCHIVED" }), "Product archived")}
          >
            Archive
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="cursor-pointer px-3 py-1.5 text-[13px] text-danger outline-none hover:bg-danger-tint"
            onSelect={(event) => {
              event.preventDefault();
              setConfirming(true);
            }}
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
