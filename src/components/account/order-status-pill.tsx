import { cn } from "@/lib/cn";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/server/orders/state-machine";

const TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-warning/12 text-warning",
  PAID: "bg-success/12 text-success",
  PROCESSING: "bg-forest-tint text-forest",
  PACKING: "bg-forest-tint text-forest",
  SHIPPED: "bg-forest-tint text-forest",
  DELIVERED: "bg-success/14 text-success",
  CANCELLED: "bg-ink/8 text-muted",
  RETURN_REQUESTED: "bg-clay-tint text-clay-deep",
  RETURNED: "bg-clay-tint text-clay-deep",
  PARTIALLY_REFUNDED: "bg-clay-tint text-clay-deep",
  REFUNDED: "bg-ink/8 text-muted",
};

export function OrderStatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center px-2 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase",
        TONE[status],
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
