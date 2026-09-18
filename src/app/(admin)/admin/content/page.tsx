import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/admin/ui";
import { ContentManager } from "@/components/admin/content-manager";

export const metadata: Metadata = { title: "Storefront content", robots: { index: false, follow: false } };

export default async function ContentPage() {
  await requirePermission("content:write");

  const [sections, banners] = await Promise.all([
    prisma.homepageSection.findMany({ orderBy: { position: "asc" } }),
    prisma.banner.findMany({ orderBy: [{ placement: "asc" }, { position: "asc" }] }),
  ]);

  return (
    <>
      <PageHeader
        title="Storefront content"
        description="The homepage is composed from these sections. Reorder, retitle or switch them off — the page follows."
      />
      <ContentManager
        sections={sections.map((section) => ({
          id: section.id,
          kind: section.kind,
          title: section.title ?? "",
          subtitle: section.subtitle ?? "",
          position: section.position,
          isActive: section.isActive,
        }))}
        banners={banners.map((banner) => ({
          id: banner.id,
          placement: banner.placement,
          headline: banner.headline,
          subtext: banner.subtext ?? "",
          ctaLabel: banner.ctaLabel ?? "",
          ctaHref: banner.ctaHref ?? "",
          isActive: banner.isActive,
          position: banner.position,
        }))}
      />
    </>
  );
}
