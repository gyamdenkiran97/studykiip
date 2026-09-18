import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  assertTransition,
  canTransition,
  InvalidTransitionError,
  ORDER_STATUSES,
} from "@/server/orders/state-machine";

describe("order state machine", () => {
  it("allows the declared happy path", () => {
    const path = ["PENDING_PAYMENT", "PAID", "PROCESSING", "PACKING", "SHIPPED", "DELIVERED"] as const;
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it("rejects undeclared transitions", () => {
    expect(canTransition("PENDING_PAYMENT", "SHIPPED")).toBe(false);
    expect(canTransition("DELIVERED", "PENDING_PAYMENT")).toBe(false);
    expect(canTransition("CANCELLED", "PAID")).toBe(false);
    expect(() => assertTransition("PENDING_PAYMENT", "DELIVERED")).toThrow(InvalidTransitionError);
  });

  it("treats CANCELLED and REFUNDED as terminal", () => {
    expect(allowedTransitions("CANCELLED")).toHaveLength(0);
    expect(allowedTransitions("REFUNDED")).toHaveLength(0);
  });

  it("never allows a status to transition to itself", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("allows cancellation only before shipment", () => {
    expect(canTransition("PAID", "CANCELLED")).toBe(true);
    expect(canTransition("PACKING", "CANCELLED")).toBe(true);
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(false);
  });
});
