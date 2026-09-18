"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ProductImage } from "@/components/ui/product-image";
import type { GalleryImage } from "./types";

/**
 * Product gallery.
 *
 * Desktop: a thumbnail column beside a large frame with pointer-tracked zoom.
 * Touch: a snap-scrolling strip with dot indicators — no zoom overlay, because
 * pinch-to-zoom already works and an overlay would fight it.
 */
export function ProductGallery({
  images,
  activeVariantId,
  title,
}: {
  images: GalleryImage[];
  activeVariantId: string | null;
  title: string;
}) {
  const [index, setIndex] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const stripRef = useRef<HTMLDivElement>(null);

  // Selecting a variant with its own photography jumps the gallery to it.
  useEffect(() => {
    if (!activeVariantId) return;
    // The list is already ordered with the active colourway first.
    const target = images.findIndex((image) => image.variantId !== null);
    setIndex(target >= 0 ? target : 0);
  }, [activeVariantId, images]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const child = strip.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [index]);

  if (images.length === 0) {
    return <div className="aspect-5/6 w-full bg-paper-deep" aria-hidden="true" />;
  }

  const active = images[Math.min(index, images.length - 1)];

  return (
    <div className="lg:flex lg:gap-4">
      {images.length > 1 ? (
        <div className="hidden lg:block">
          <ul className="flex flex-col gap-2.5">
            {images.map((image, imageIndex) => (
              <li key={image.url}>
                <button
                  type="button"
                  onClick={() => setIndex(imageIndex)}
                  aria-label={`Show image ${imageIndex + 1} of ${images.length}`}
                  aria-current={imageIndex === index}
                  className={cn(
                    "relative block h-20 w-16 overflow-hidden bg-paper-deep transition-opacity",
                    imageIndex === index ? "ring-1 ring-ink" : "opacity-65 hover:opacity-100",
                  )}
                >
                  <ProductImage src={image.url} alt="" sizes="64px" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        {/* Desktop frame with zoom */}
        <div
          className="relative hidden aspect-5/6 w-full overflow-hidden bg-paper-deep lg:block"
          onMouseEnter={() => setZooming(true)}
          onMouseLeave={() => setZooming(false)}
          onMouseMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setOrigin({
              x: ((event.clientX - bounds.left) / bounds.width) * 100,
              y: ((event.clientY - bounds.top) / bounds.height) * 100,
            });
          }}
        >
          <div
            className="absolute inset-0 transition-transform duration-500 ease-[var(--ease-out-soft)] motion-reduce:transform-none"
            style={{
              transform: zooming ? "scale(1.75)" : "scale(1)",
              transformOrigin: `${origin.x}% ${origin.y}%`,
            }}
          >
            <ProductImage src={active.url} alt={active.alt} sizes="(max-width: 1024px) 100vw, 46vw" priority />
          </div>
        </div>

        {/* Touch strip */}
        <div
          ref={stripRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto lg:hidden"
          aria-label={`${title} images`}
        >
          {images.map((image, imageIndex) => (
            <div
              key={image.url}
              className="relative aspect-5/6 w-[86vw] shrink-0 snap-center bg-paper-deep"
              onFocus={() => setIndex(imageIndex)}
            >
              <ProductImage
                src={image.url}
                alt={image.alt}
                sizes="86vw"
                priority={imageIndex === 0}
              />
            </div>
          ))}
        </div>

        {images.length > 1 ? (
          <div className="mt-3 flex justify-center gap-1.5 lg:hidden">
            {images.map((image, imageIndex) => (
              <button
                key={image.url}
                type="button"
                onClick={() => setIndex(imageIndex)}
                aria-label={`Go to image ${imageIndex + 1}`}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  imageIndex === index ? "bg-ink" : "bg-line-strong",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
