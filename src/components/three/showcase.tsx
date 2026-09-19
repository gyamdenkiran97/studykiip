"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/ui/product-image";

/**
 * 3D showcase gate.
 *
 * The WebGL bundle is never part of the initial page. It is imported only when
 * all of these hold:
 *   - the section has scrolled into view,
 *   - the visitor has not asked for reduced motion,
 *   - the device reports enough cores and is not on a narrow screen,
 *   - WebGL is actually available.
 * Otherwise the static generated image stays, which is a complete experience in
 * its own right. Nothing about buying the product depends on this loading.
 */

const Scene = dynamic(() => import("./scene"), { ssr: false, loading: () => null });

export function Showcase3D({
  fallbackImageUrl,
  fallbackImageAlt,
}: {
  fallbackImageUrl: string | null;
  fallbackImageAlt: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [spin, setSpin] = useState(true);
  const [dpr, setDpr] = useState(1.5);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const smallScreen = window.matchMedia("(max-width: 767px)").matches;
    const lowPower = (navigator.hardwareConcurrency ?? 4) < 4;
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

    if (reducedMotion || smallScreen || lowPower || saveData) return;
    if (!supportsWebGl()) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Resolved here rather than in the effect body: the value is only
          // read once the canvas mounts, which is exactly now.
          setDpr(Math.min(window.devicePixelRatio || 1, 1.75));
          setEnabled(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Stop rendering work while the tab is hidden or the section is off-screen.
  useEffect(() => {
    if (!enabled) return;
    const element = containerRef.current;
    if (!element) return;

    const onVisibility = () => setSpin(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    const observer = new IntersectionObserver(([entry]) => setSpin(entry.isIntersecting && !document.hidden), {
      threshold: 0.05,
    });
    observer.observe(element);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
    };
  }, [enabled]);

  return (
    <div ref={containerRef} className="relative aspect-4/3 w-full overflow-hidden bg-paper-deep lg:aspect-square">
      {enabled ? (
        <Scene spin={spin} dpr={dpr} />
      ) : (
        <ProductImage src={fallbackImageUrl} alt={fallbackImageAlt} sizes="(max-width: 1024px) 100vw, 48vw" />
      )}
    </div>
  );
}

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
