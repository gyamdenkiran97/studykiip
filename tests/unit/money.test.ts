import { describe, expect, it } from "vitest";
import {
  allocateByWeight,
  applyBps,
  discountPercent,
  formatMoney,
  parseMoneyInput,
  roundHalfUp,
  sumCents,
  toMoneyInput,
} from "@/lib/money";

describe("money", () => {
  it("rejects non-integer amounts so floats can never enter a total", () => {
    expect(() => applyBps(10.5, 2000)).toThrow(TypeError);
    expect(() => sumCents([100, 99.99])).toThrow(TypeError);
  });

  it("rounds half away from zero", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(2.4)).toBe(2);
  });

  it("applies basis-point rates deterministically", () => {
    expect(applyBps(1999, 2000)).toBe(400); // 19.99 @ 20% = 3.998 -> 4.00
    expect(applyBps(1, 2000)).toBe(0);
    expect(applyBps(999, 750)).toBe(75);
  });

  it("allocates an amount across weights without losing or inventing a penny", () => {
    const allocation = allocateByWeight(100, [1, 1, 1]);
    expect(allocation).toEqual([34, 33, 33]);
    expect(allocation.reduce((a, b) => a + b, 0)).toBe(100);

    const uneven = allocateByWeight(1000, [3000, 1999, 501]);
    expect(uneven.reduce((a, b) => a + b, 0)).toBe(1000);

    expect(allocateByWeight(500, [0, 0])).toEqual([0, 0]);
  });

  it("formats and parses money without float drift", () => {
    expect(formatMoney(1999, "GBP")).toBe("£19.99");
    expect(formatMoney(0, "GBP")).toBe("£0.00");
    expect(parseMoneyInput("19.99")).toBe(1999);
    expect(parseMoneyInput("0.1")).toBe(10);
    expect(parseMoneyInput("19.999")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(toMoneyInput(1999)).toBe("19.99");
    expect(toMoneyInput(5)).toBe("0.05");
  });

  it("computes a sale badge percentage", () => {
    expect(discountPercent(10000, 7500)).toBe(25);
    expect(discountPercent(10000, 10000)).toBe(0);
    expect(discountPercent(0, 0)).toBe(0);
  });

  it("handles zero-decimal currencies", () => {
    expect(toMoneyInput(1500, "JPY")).toBe("1500");
    expect(parseMoneyInput("1500", "JPY")).toBe(1500);
  });
});
