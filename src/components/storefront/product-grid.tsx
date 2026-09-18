import type { ProductCard as ProductCardData } from "@/server/catalog/types";
import { cn } from "@/lib/cn";
import { ProductCard } from "./product-card";

export function ProductGrid({
  products,
  wishlisted,
  columns = 4,
  priorityCount = 4,
  className,
}: {
  products: ProductCardData[];
  wishlisted?: Set<string>;
  columns?: 3 | 4;
  priorityCount?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:gap-y-14",
        columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
        "md:grid-cols-3",
        className,
      )}
    >
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={index < priorityCount}
          isWishlisted={wishlisted?.has(product.id) ?? false}
          sizes={
            columns === 4
              ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 23vw"
              : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 31vw"
          }
        />
      ))}
    </div>
  );
}
