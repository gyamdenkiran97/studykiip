import "server-only";
import { prisma } from "../db";

/** Reference data every catalogue editor needs. Loaded once per page. */
export async function getEditorReferenceData() {
  const [brands, categories, taxClasses, attributeDefinitions] = await Promise.all([
    prisma.brand.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, parentId: true },
    }),
    prisma.taxClass.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, rateBps: true } }),
    prisma.attributeDefinition.findMany({
      orderBy: { position: "asc" },
      select: { key: true, label: true, type: true, unit: true, options: true },
    }),
  ]);

  const nameById = new Map(categories.map((category) => [category.id, category.name]));

  return {
    brands,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      parentName: category.parentId ? (nameById.get(category.parentId) ?? null) : null,
    })),
    taxClasses,
    attributeDefinitions: attributeDefinitions.map((definition) => ({
      key: definition.key,
      label: definition.label,
      type: definition.type as string,
      unit: definition.unit,
      options: definition.options,
    })),
  };
}
