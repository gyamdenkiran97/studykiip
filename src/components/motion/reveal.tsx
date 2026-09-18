"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Scroll reveal.
 *
 * IntersectionObserver rather than a scroll listener, one-shot, and skipped
 * entirely when the visitor prefers reduced motion — in which case content is
 * simply visible from the start.
 *
 * The observed element and the animated element are deliberately separate: a
 * `clip-path` that hides the target also collapses the rectangle the observer
 * measures, so observing the clipped node means it can never become visible.
 * The outer element keeps its natural box; the inner one carries the effect.
 */
export function Reveal({
  children,
  delay = 0,
  variant = "rise",
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  variant?: "rise" | "mask" | "fade";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setRevealed(false);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const effect: Record<string, string> = {
    rise: revealed ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
    fade: revealed ? "opacity-100" : "opacity-0",
    mask: revealed ? "[clip-path:inset(0_0_0_0)]" : "[clip-path:inset(0_0_100%_0)]",
  };

  return (
    <div ref={ref} className={className}>
      <div
        style={{ transitionDelay: `${delay}ms` }}
        className={cn(
          "h-full transition-all duration-[850ms] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
          effect[variant],
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Staggers children by index — used for product rails and category grids. */
export function RevealGroup({
  children,
  step = 70,
  className,
}: {
  children: React.ReactNode;
  step?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <Reveal key={index} delay={Math.min(index * step, 420)}>
              {child}
            </Reveal>
          ))
        : children}
    </div>
  );
}
