"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatMoney, parseMoneyInput, toMoneyInput } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/server/orders/state-machine";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  addOrderNoteAction,
  createShipmentAction,
  refundOrderAction,
  updateOrderStatusAction,
  updateReturnRequestAction,
} from "@/server/actions/admin/orders";

/**
 * Operational controls for one order.
 *
 * Only transitions the state machine permits are offered, and controls the
 * signed-in user lacks permission for are not rendered — the server enforces
 * both independently.
 */
export function OrderAdminActions({
  orderId,
  status,
  allowedStatuses,
  canWrite,
  canRefund,
  refundableCents,
  currency,
  adminNote,
  hasShipment,
  returnRequest,
}: {
  orderId: string;
  status: OrderStatus;
  allowedStatuses: OrderStatus[];
  canWrite: boolean;
  canRefund: boolean;
  refundableCents: number;
  currency: string;
  adminNote: string | null;
  hasShipment: boolean;
  returnRequest: { id: string; status: string; reason: string; comment: string | null } | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [refundAmount, setRefundAmount] = useState(toMoneyInput(refundableCents, currency));
  const [showShipment, setShowShipment] = useState(false);

  async function run<T>(operation: () => Promise<{ ok: true; data: T } | { ok: false; message: string }>, success: string) {
    setPending(true);
    const result = await operation();
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    toast.success(success);
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-6">
      {canWrite ? (
        <Panel title="Status">
          {allowedStatuses.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-muted">
              {ORDER_STATUS_LABELS[status]} is a final state — no further transitions are possible.
            </p>
          ) : (
            <form
              className="space-y-3 px-5 py-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                await run(
                  () =>
                    updateOrderStatusAction({
                      orderId,
                      status: String(formData.get("status")),
                      note: String(formData.get("note") ?? "") || undefined,
                    }),
                  "Order status updated",
                );
              }}
            >
              <Field label="Move to" htmlFor="status">
                <Select id="status" name="status" defaultValue={allowedStatuses[0]}>
                  {allowedStatuses.map((entry) => (
                    <option key={entry} value={entry}>
                      {ORDER_STATUS_LABELS[entry]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Internal note (optional)" htmlFor="note">
                <Input id="note" name="note" maxLength={500} placeholder="Why this change" />
              </Field>
              <Button type="submit" size="sm" disabled={pending}>
                Update status
              </Button>
            </form>
          )}
        </Panel>
      ) : null}

      {canWrite && !hasShipment ? (
        <Panel title="Shipment">
          {showShipment ? (
            <form
              className="space-y-3 px-5 py-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const ok = await run(
                  () =>
                    createShipmentAction({
                      orderId,
                      carrier: String(formData.get("carrier") ?? ""),
                      trackingNumber: String(formData.get("trackingNumber") ?? "") || undefined,
                      trackingUrl: String(formData.get("trackingUrl") ?? ""),
                      markShipped: formData.get("markShipped") === "on",
                    }),
                  "Shipment recorded and customer notified",
                );
                if (ok) setShowShipment(false);
              }}
            >
              <Field label="Carrier" htmlFor="carrier">
                <Input id="carrier" name="carrier" required placeholder="Royal Mail, DPD, Evri…" />
              </Field>
              <Field label="Tracking number" htmlFor="trackingNumber">
                <Input id="trackingNumber" name="trackingNumber" />
              </Field>
              <Field label="Tracking URL" htmlFor="trackingUrl">
                <Input id="trackingUrl" name="trackingUrl" type="url" placeholder="https://" />
              </Field>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  name="markShipped"
                  defaultChecked
                  className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
                />
                Mark the order as shipped
              </label>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  Save shipment
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowShipment(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="px-5 py-4">
              <Button size="sm" variant="outline" onClick={() => setShowShipment(true)}>
                Record a shipment
              </Button>
            </div>
          )}
        </Panel>
      ) : null}

      {canRefund && refundableCents > 0 ? (
        <Panel title="Refund" description={`${formatMoney(refundableCents, currency)} still refundable.`}>
          <form
            className="space-y-3 px-5 py-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const amountCents = parseMoneyInput(refundAmount, currency);
              if (amountCents === null || amountCents <= 0) {
                toast.error("Enter a valid refund amount.");
                return;
              }
              if (amountCents > refundableCents) {
                toast.error("That is more than the refundable amount.");
                return;
              }
              const formData = new FormData(event.currentTarget);
              await run(
                () =>
                  refundOrderAction({
                    orderId,
                    amountCents,
                    reason: String(formData.get("reason") ?? "") || undefined,
                  }),
                "Refund issued",
              );
            }}
          >
            <Field label={`Amount (${currency})`} htmlFor="refundAmount">
              <Input
                id="refundAmount"
                inputMode="decimal"
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
              />
            </Field>
            <Field label="Reason" htmlFor="reason">
              <Textarea id="reason" name="reason" rows={2} maxLength={300} />
            </Field>
            <Button type="submit" size="sm" variant="danger" disabled={pending}>
              Issue refund
            </Button>
          </form>
        </Panel>
      ) : null}

      {returnRequest && canWrite ? (
        <Panel title="Return request" description={`Reason: ${returnRequest.reason}`}>
          <form
            className="space-y-3 px-5 py-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              await run(
                () =>
                  updateReturnRequestAction({
                    returnId: returnRequest.id,
                    status: String(formData.get("returnStatus")),
                    resolution: String(formData.get("resolution") ?? "") || undefined,
                  }),
                "Return updated and customer notified",
              );
            }}
          >
            {returnRequest.comment ? (
              <p className="text-[12.5px] text-muted">“{returnRequest.comment}”</p>
            ) : null}
            <Field label="Update to" htmlFor="returnStatus">
              <Select id="returnStatus" name="returnStatus" defaultValue="APPROVED">
                {["APPROVED", "REJECTED", "IN_TRANSIT", "RECEIVED", "REFUNDED", "CANCELLED"].map((entry) => (
                  <option key={entry} value={entry}>
                    {entry.toLowerCase().replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Message to the customer" htmlFor="resolution">
              <Textarea id="resolution" name="resolution" rows={2} maxLength={500} />
            </Field>
            <Button type="submit" size="sm" disabled={pending}>
              Update return
            </Button>
          </form>
        </Panel>
      ) : null}

      {canWrite ? (
        <Panel title="Internal note" description="Visible to staff only.">
          <form
            className="space-y-3 px-5 py-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              await run(
                () => addOrderNoteAction({ orderId, note: String(formData.get("adminNote") ?? "") }),
                "Note saved",
              );
            }}
          >
            <Textarea name="adminNote" rows={3} defaultValue={adminNote ?? ""} maxLength={2000} />
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              Save note
            </Button>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
