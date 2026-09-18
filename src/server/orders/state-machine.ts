/**
 * Order lifecycle.
 *
 * Transitions are declared once, here. Anything not declared cannot happen —
 * `assertTransition` throws rather than silently writing an impossible state.
 * Dependency-free so it can be unit tested in isolation.
 */

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "PACKING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"],
  PROCESSING: ["PACKING", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"],
  PACKING: ["SHIPPED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"],
  SHIPPED: ["DELIVERED", "RETURN_REQUESTED", "PARTIALLY_REFUNDED", "REFUNDED"],
  DELIVERED: ["RETURN_REQUESTED", "PARTIALLY_REFUNDED", "REFUNDED"],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED", "PARTIALLY_REFUNDED", "REFUNDED"],
  RETURNED: ["REFUNDED", "PARTIALLY_REFUNDED"],
  PARTIALLY_REFUNDED: ["REFUNDED", "RETURN_REQUESTED"],
  // Terminal states.
  CANCELLED: [],
  REFUNDED: [],
};

/** Statuses at which stock must be back on the shelf. */
export const STOCK_RELEASING_STATUSES: readonly OrderStatus[] = ["CANCELLED", "RETURNED", "REFUNDED"];

/** Statuses a customer is allowed to cancel from without staff involvement. */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ["PENDING_PAYMENT", "PAID", "PROCESSING"];

/** Statuses from which a customer may open a return. */
export const RETURNABLE: readonly OrderStatus[] = ["SHIPPED", "DELIVERED"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`Cannot move an order from ${from} to ${to}.`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** Column that records when the order entered a given status. */
export const STATUS_TIMESTAMP_FIELD: Partial<Record<OrderStatus, string>> = {
  PAID: "paidAt",
  PROCESSING: "processingAt",
  PACKING: "packedAt",
  SHIPPED: "shippedAt",
  DELIVERED: "deliveredAt",
  CANCELLED: "cancelledAt",
  RETURNED: "returnedAt",
  REFUNDED: "refundedAt",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  PROCESSING: "Processing",
  PACKING: "Packing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
};

/** Progress track shown to customers; refund/cancel states fall outside it. */
export const FULFILMENT_TRACK: readonly OrderStatus[] = [
  "PAID",
  "PROCESSING",
  "PACKING",
  "SHIPPED",
  "DELIVERED",
];
