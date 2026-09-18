"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { adjustStockAction } from "@/server/actions/admin/inventory";

/**
 * Stock adjustment.
 *
 * Deliberately a signed delta with a reason rather than a "set to" field: every
 * movement is recorded as a transaction, so the history explains itself later.
 */
export function StockAdjuster({
  variantId,
  sku,
  available,
}: {
  variantId: string;
  sku: string;
  available: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="border border-line-strong px-2.5 py-1 text-[12px] hover:border-ink">
        Adjust
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 border border-line bg-surface p-4 shadow-raise"
        >
          <p className="text-[12px] text-muted">
            <span className="font-mono">{sku}</span> · {available} available
          </p>

          <form
            className="mt-3 space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const delta = Number(formData.get("delta"));
              if (!Number.isInteger(delta) || delta === 0) {
                toast.error("Enter a non-zero whole number.");
                return;
              }

              setPending(true);
              const result = await adjustStockAction({
                variantId,
                onHandDelta: delta,
                reason: String(formData.get("reason")),
                note: String(formData.get("note") ?? "") || undefined,
              });
              setPending(false);

              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success(`Stock updated — ${result.data.available} available`);
              setOpen(false);
              router.refresh();
            }}
          >
            <Field label="Change by" htmlFor={`delta-${variantId}`} hint="Use a negative number to remove stock.">
              <Input id={`delta-${variantId}`} name="delta" inputMode="numeric" defaultValue="1" required />
            </Field>

            <Field label="Reason" htmlFor={`reason-${variantId}`}>
              <Select id={`reason-${variantId}`} name="reason" defaultValue="RESTOCK">
                <option value="RESTOCK">Restock</option>
                <option value="CORRECTION">Stock count correction</option>
                <option value="DAMAGE">Damaged or written off</option>
                <option value="RETURN">Returned to stock</option>
              </Select>
            </Field>

            <Field label="Note (optional)" htmlFor={`note-${variantId}`}>
              <Input id={`note-${variantId}`} name="note" maxLength={300} />
            </Field>

            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Apply"}
              </Button>
              <Popover.Close asChild>
                <Button type="button" size="sm" variant="ghost">
                  Cancel
                </Button>
              </Popover.Close>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
