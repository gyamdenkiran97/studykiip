import { describe, expect, it } from "vitest";
import { testDb } from "./helpers/setup";
import { createProduct, createWarehouse } from "./helpers/fixtures";
import { slugify, uniqueSlug } from "@/server/catalog/slug";

describe("slugify", () => {
  it("produces clean ASCII slugs", () => {
    expect(slugify("Storm Overcoat")).toBe("storm-overcoat");
    expect(slugify("Café Crème")).toBe("cafe-creme");
    expect(slugify("Salt & Pepper")).toBe("salt-and-pepper");
    expect(slugify("  Multiple   Spaces  ")).toBe("multiple-spaces");
    expect(slugify("Trailing---")).toBe("trailing");
  });

  it("is stable for the same input", () => {
    expect(slugify("Lambswool Crew Neck")).toBe(slugify("Lambswool Crew Neck"));
  });

  it("caps the length", () => {
    expect(slugify("word ".repeat(80)).length).toBeLessThanOrEqual(120);
  });
});

describe("uniqueSlug", () => {
  it("returns the desired slug when it is free", async () => {
    expect(await uniqueSlug("a-brand-new-slug")).toBe("a-brand-new-slug");
  });

  it("appends a counter when the slug is taken", async () => {
    const warehouse = await createWarehouse();
    const { product } = await createProduct({ warehouseId: warehouse.id });
    await testDb.product.update({ where: { id: product.id }, data: { slug: "taken-slug" } });

    expect(await uniqueSlug("taken-slug")).toBe("taken-slug-2");
  });

  it("lets a record keep its own slug while editing", async () => {
    const warehouse = await createWarehouse();
    const { product } = await createProduct({ warehouseId: warehouse.id });
    await testDb.product.update({ where: { id: product.id }, data: { slug: "my-slug" } });

    expect(await uniqueSlug("my-slug", product.id)).toBe("my-slug");
  });

  it("keeps product and category namespaces separate", async () => {
    await testDb.category.create({ data: { name: "Shared", slug: "shared-name" } });
    // A category holding the slug must not push the product to -2.
    expect(await uniqueSlug("shared-name", undefined, "product")).toBe("shared-name");
    expect(await uniqueSlug("shared-name", undefined, "category")).toBe("shared-name-2");
  });
});
