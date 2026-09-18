"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { cancelOrderAction, requestReturnAction } from "@/server/actions/orders";

const RETURN_REASONS = [
  "Does not fit",
  "Not as described",
  "Arrived damaged",
  "Changed my mind",
  "Ordered the wrong item",
  "Other",
];

/** Cancellation and returns. Only the actions the order's status permits appear. */
export function OrderActions({
  orderId,
  canCancel,
  canReturn,
  items,
  existingReturn,
}: {
  orderId: string;
  canCancel: boolean;
  canReturn: boolean;
  items: Array<{ id: string; title: string; variantTitle: string; quantity: number }>;
  existingReturn: { status: string; reason: string } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "cancel" | "return">("none");
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});

  if (existingReturn) {
    return (
      <section className="mt-10 border border-line bg-paper-deep p-5">
        <h2 className="font-display text-lg">Return in progress</h2>
        <p className="mt-2 text-[13.5px] text-muted">
          Status: {existingReturn.status.toLowerCase().replace(/_/g, " ")} · Reason: {existingReturn.reason}
        </p>
        <p className="mt-1.5 text-[13px] text-muted">
          We will email you when the return moves forward. Keep the packaging until then.
        </p>
      </section>
    );
  }

  if (!canCancel && !canReturn) return null;

  async function cancel(reason: string) {
    setPending(true);
    const result = await cancelOrderAction({ orderId, reason });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Order cancelled. Any payment will be refunded.");
    setMode("none");
    router.refresh();
  }

  async function submitReturn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const chosen = Object.entries(selected)
      .filter(([, quantity]) => quantity > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

    if (chosen.length === 0) {
      toast.error("Choose at least one item to return.");
      return;
    }

    setPending(true);
    const result = await requestReturnAction({
      orderId,
      reason: String(formData.get("reason") ?? ""),
      comment: String(formData.get("comment") ?? ""),
      items: chosen,
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Return requested. We will email you a label.");
    setMode("none");
    router.refresh();
  }

  return (
    <section className="mt-10 border border-line p-5" aria-labelledby="order-actions">
      <h2 id="order-actions" className="font-display text-lg">
        Need to change something?
      </h2>

      {mode === "none" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {canCancel ? (
            <Button variant="outline" onClick={() => setMode("cancel")}>
              Cancel this order
            </Button>
          ) : null}
          {canReturn ? (
            <Button variant="outline" onClick={() => setMode("return")}>
              Return items
            </Button>
          ) : null}
        </div>
      ) : null}

      {mode === "cancel" ? (
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void cancel(String(formData.get("reason") ?? ""));
          }}
        >
          <Field label="Why are you cancelling? (optional)" htmlFor="cancel-reason">
            <Textarea id="cancel-reason" name="reason" rows={2} maxLength={300} />
          </Field>
          <p className="text-[13px] text-muted">
            Cancelling releases the stock straight away. Any payment already taken is refunded to the original
            method.
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Cancelling…" : "Confirm cancellation"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("none")}>
              Keep my order
            </Button>
          </div>
        </form>
      ) : null}

      {mode === "return" ? (
        <form className="mt-4 space-y-4" onSubmit={submitReturn}>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-soft">Which items?</legend>
            <ul className="space-y-2">
              {items
                .filter((item) => item.quantity > 0)
                .map((item) => (
                  <li key={item.id} className="flex items-center gap-3 border border-line p-3">
                    <label className="flex flex-1 items-center gap-3 text-[13.5px]">
                      <input
                        type="checkbox"
                        checked={(selected[item.id] ?? 0) > 0}
                        onChange={(event) =>
                          setSelected((current) => ({
                            ...current,
                            [item.id]: event.target.checked ? 1 : 0,
                          }))
                        }
                        className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
                      />
                      <span>
                        <span className="block font-medium">{item.title}</span>
                        <span className="block text-muted">{item.variantTitle}</span>
                      </span>
                    </label>
                    {(selected[item.id] ?? 0) > 0 && item.quantity > 1 ? (
                      <label className="text-[13px] text-muted">
                        Qty
                        <input
                          type="number"
                          min={1}
                          max={item.quantity}
                          value={selected[item.id]}
                          onChange={(event) =>
                            setSelected((current) => ({
                              ...current,
                              [item.id]: Math.min(item.quantity, Math.max(1, Number(event.target.value))),
                            }))
                          }
                          className="tabular ml-2 h-8 w-16 border border-line-strong px-2 text-center"
                        />
                      </label>
                    ) : null}
                  </li>
                ))}
            </ul>
          </fieldset>

          <Field label="Reason" htmlFor="return-reason">
            <Select id="return-reason" name="reason" required defaultValue="">
              <option value="" disabled>
                Choose a reason
              </option>
              {RETURN_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Anything else we should know? (optional)" htmlFor="return-comment">
            <Textarea id="return-comment" name="comment" rows={3} maxLength={1000} />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Request return"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("none")}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
