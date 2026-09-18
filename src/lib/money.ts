/**
 * Money is represented everywhere as an integer number of minor units
 * (pence, cents) together with an ISO-4217 currency code. Floating point
 * is never used for a monetary value.
 *
 * Rates (tax, discount percentages) are integers in basis points:
 * 2000 bps = 20.00%.
 */

export const DEFAULT_CURRENCY = "GBP";

/** Minor units per major unit. Extend when a zero-decimal currency is needed. */
const MINOR_UNIT_EXPONENT: Record<string, number> = {
  JPY: 0,
  KRW: 0,
};

export function minorUnitExponent(currency: string): number {
  return MINOR_UNIT_EXPONENT[currency.toUpperCase()] ?? 2;
}

/** Round half away from zero — the convention customers and auditors expect. */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Apply a basis-point rate to an integer amount, returning integer minor units. */
export function applyBps(amountCents: number, bps: number): number {
  assertInteger(amountCents, "amountCents");
  assertInteger(bps, "bps");
  return roundHalfUp((amountCents * bps) / 10_000);
}

/** Sum integer amounts, guarding against accidental float contamination. */
export function sumCents(amounts: readonly number[]): number {
  return amounts.reduce<number>((total, amount) => {
    assertInteger(amount, "amount");
    return total + amount;
  }, 0);
}

/** Clamp an amount to a non-negative integer. */
export function clampNonNegative(amountCents: number): number {
  return amountCents < 0 ? 0 : Math.trunc(amountCents);
}

/**
 * Split an amount across weights while preserving the total exactly
 * (largest-remainder method). Used to distribute an order-level discount
 * across line items without losing or inventing a penny.
 */
export function allocateByWeight(amountCents: number, weights: readonly number[]): number[] {
  assertInteger(amountCents, "amountCents");
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0 || weights.length === 0) return weights.map(() => 0);

  const exact = weights.map((w) => (amountCents * w) / totalWeight);
  const floored = exact.map((value) => Math.floor(value));
  let remainder = amountCents - floored.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floored];
  for (let i = 0; remainder > 0 && i < order.length; i += 1, remainder -= 1) {
    result[order[i].index] += 1;
  }
  return result;
}

export function formatMoney(
  amountCents: number,
  currency: string = DEFAULT_CURRENCY,
  locale = "en-GB",
): string {
  const exponent = minorUnitExponent(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(amountCents / 10 ** exponent);
}

/** Percentage off, rounded to the nearest whole percent, for badges. */
export function discountPercent(priceCents: number, salePriceCents: number): number {
  if (priceCents <= 0 || salePriceCents >= priceCents) return 0;
  return Math.round(((priceCents - salePriceCents) / priceCents) * 100);
}

/** Parse "12.34" into 1234 minor units. Returns null on anything malformed. */
export function parseMoneyInput(input: string, currency: string = DEFAULT_CURRENCY): number | null {
  const trimmed = input.trim().replace(/[, ]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const exponent = minorUnitExponent(currency);
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > exponent) return null;
  const padded = fraction.padEnd(exponent, "0");
  const sign = whole.startsWith("-") ? -1 : 1;
  const value = Number(whole.replace("-", "")) * 10 ** exponent + Number(padded || "0");
  return sign * value;
}

/** Render minor units as a plain decimal string for form inputs. */
export function toMoneyInput(amountCents: number, currency: string = DEFAULT_CURRENCY): string {
  const exponent = minorUnitExponent(currency);
  if (exponent === 0) return String(amountCents);
  const sign = amountCents < 0 ? "-" : "";
  const abs = Math.abs(amountCents);
  const whole = Math.floor(abs / 10 ** exponent);
  const fraction = String(abs % 10 ** exponent).padStart(exponent, "0");
  return `${sign}${whole}.${fraction}`;
}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer number of minor units, received ${value}`);
  }
}
