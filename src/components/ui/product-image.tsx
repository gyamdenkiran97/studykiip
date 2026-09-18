import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Product imagery.
 *
 * Demo media is generated SVG: resolution-independent and already ~2KB, so it
 * bypasses the raster optimiser (which cannot improve on it and would require
 * enabling SVG processing). Uploaded production media is raster and goes
 * through next/image normally.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  priority,
  className,
  fill = true,
  width,
  height,
}: {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
}) {
  if (!src) {
    return (
      <div
        className={cn("flex items-center justify-center bg-paper-deep text-muted-soft", className)}
        aria-hidden="true"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="3" y="4" width="18" height="16" />
          <path d="M3 16l5-5 4 4 3-3 6 6" />
        </svg>
      </div>
    );
  }

  const isVector = src.endsWith(".svg");

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "(max-width: 768px) 50vw, 25vw"}
        priority={priority}
        unoptimized={isVector}
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 600}
      height={height ?? 720}
      priority={priority}
      unoptimized={isVector}
      className={className}
    />
  );
}
