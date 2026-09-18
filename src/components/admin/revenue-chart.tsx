"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";

/**
 * Revenue chart.
 *
 * Hand-drawn SVG rather than a charting library: one series, one axis, and no
 * 60KB dependency. Values are also exposed as a visually-hidden table so the
 * data is available to screen readers rather than locked in a picture.
 */
export function RevenueChart({
  series,
}: {
  series: Array<{ date: string; revenueCents: number; orders: number }>;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { points, max, path, area } = useMemo(() => {
    const width = 100;
    const height = 36;
    const maxValue = Math.max(...series.map((point) => point.revenueCents), 1);

    const computed = series.map((point, index) => ({
      ...point,
      x: series.length > 1 ? (index / (series.length - 1)) * width : 0,
      y: height - (point.revenueCents / maxValue) * height,
    }));

    const line = computed
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" ");

    return {
      points: computed,
      max: maxValue,
      path: line,
      area: `${line} L100,36 L0,36 Z`,
    };
  }, [series]);

  const total = series.reduce((sum, point) => sum + point.revenueCents, 0);
  const active = hovered !== null ? points[hovered] : null;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="tabular font-display text-xl">{formatMoney(total)}</p>
        <p className="text-[12px] text-muted">
          {active
            ? `${new Date(active.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${formatMoney(active.revenueCents)}`
            : `Peak ${formatMoney(max)}`}
        </p>
      </div>

      <div className="relative mt-4" onMouseLeave={() => setHovered(null)}>
        <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-36 w-full" aria-hidden="true">
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-clay)" stopOpacity="0.16" />
              <stop offset="1" stopColor="var(--color-clay)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#revenue-fill)" />
          <path
            d={path}
            fill="none"
            stroke="var(--color-clay)"
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          {active ? (
            <circle cx={active.x} cy={active.y} r="0.9" fill="var(--color-clay)" vectorEffect="non-scaling-stroke" />
          ) : null}
        </svg>

        {/* Hover targets sit above the chart, one per day. */}
        <div className="absolute inset-0 flex">
          {points.map((point, index) => (
            <button
              key={point.date}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onMouseEnter={() => setHovered(index)}
              className="h-full flex-1"
            />
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>Daily revenue for the last {series.length} days</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Revenue</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {series.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{formatMoney(point.revenueCents)}</td>
              <td>{point.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
