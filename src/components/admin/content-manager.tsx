"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Panel } from "./ui";
import {
  deleteBannerAction,
  saveBannerAction,
  updateHomepageSectionAction,
} from "@/server/actions/admin/marketing";

type Section = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  position: number;
  isActive: boolean;
};

type BannerRow = {
  id: string;
  placement: string;
  headline: string;
  subtext: string;
  ctaLabel: string;
  ctaHref: string;
  isActive: boolean;
  position: number;
};

const KIND_LABELS: Record<string, string> = {
  HERO: "Hero",
  CATEGORY_GRID: "Department grid",
  PRODUCT_CAROUSEL: "Product rail",
  EDITORIAL: "Editorial block",
  BANNER: "Campaign banner",
  SHOWCASE_3D: "3D showcase",
  BENEFITS: "Service promises",
  NEWSLETTER: "Newsletter",
};

export function ContentManager({ sections, banners }: { sections: Section[]; banners: BannerRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [creatingBanner, setCreatingBanner] = useState(false);

  async function saveSection(section: Section, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(section.id);

    const result = await updateHomepageSectionAction({
      id: section.id,
      title: String(formData.get("title") ?? ""),
      subtitle: String(formData.get("subtitle") ?? ""),
      position: Number(formData.get("position") ?? 0),
      isActive: formData.get("isActive") === "on",
    });

    setPending(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Section updated");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Panel title="Homepage sections" description="Position sets the order; lower numbers appear first.">
        <ul className="divide-y divide-line">
          {sections.map((section) => (
            <li key={section.id} className="px-5 py-4">
              <form onSubmit={(event) => saveSection(section, event)} className="grid gap-3 lg:grid-cols-[150px_1fr_1fr_90px_auto]">
                <div className="flex items-center gap-2">
                  <Badge tone={section.isActive ? "success" : "out"}>{KIND_LABELS[section.kind] ?? section.kind}</Badge>
                </div>

                <Field label="Title" htmlFor={`title-${section.id}`}>
                  <Input id={`title-${section.id}`} name="title" defaultValue={section.title} maxLength={200} />
                </Field>

                <Field label="Subtitle" htmlFor={`subtitle-${section.id}`}>
                  <Input id={`subtitle-${section.id}`} name="subtitle" defaultValue={section.subtitle} maxLength={400} />
                </Field>

                <Field label="Position" htmlFor={`position-${section.id}`}>
                  <Input
                    id={`position-${section.id}`}
                    name="position"
                    inputMode="numeric"
                    defaultValue={section.position}
                  />
                </Field>

                <div className="flex items-end gap-3 pb-1">
                  <label className="flex items-center gap-2 text-[12.5px] whitespace-nowrap">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={section.isActive}
                      className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
                    />
                    On
                  </label>
                  <Button type="submit" size="sm" variant="secondary" disabled={pending === section.id}>
                    Save
                  </Button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Banners"
        description="Announcement bar messages rotate; other placements show the first active banner."
        actions={
          <Button size="sm" variant="outline" onClick={() => setCreatingBanner(true)}>
            <Plus size={14} strokeWidth={2} />
            New banner
          </Button>
        }
      >
        {creatingBanner ? (
          <form
            className="grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              setPending("new-banner");
              const result = await saveBannerAction({
                placement: String(formData.get("placement")),
                headline: String(formData.get("headline") ?? ""),
                subtext: String(formData.get("subtext") ?? ""),
                ctaLabel: String(formData.get("ctaLabel") ?? ""),
                ctaHref: String(formData.get("ctaHref") ?? ""),
                position: Number(formData.get("position") ?? 0),
                isActive: true,
              });
              setPending(null);
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success("Banner created");
              setCreatingBanner(false);
              router.refresh();
            }}
          >
            <Field label="Placement" htmlFor="placement">
              <Select id="placement" name="placement" defaultValue="ANNOUNCEMENT">
                <option value="ANNOUNCEMENT">Announcement bar</option>
                <option value="HOMEPAGE_HERO">Homepage hero</option>
                <option value="CATEGORY_TOP">Top of category pages</option>
                <option value="CART_DRAWER">Basket drawer</option>
              </Select>
            </Field>
            <Field label="Position" htmlFor="bannerPosition">
              <Input id="bannerPosition" name="position" inputMode="numeric" defaultValue="0" />
            </Field>
            <Field label="Headline" htmlFor="headline" className="sm:col-span-2">
              <Input id="headline" name="headline" required maxLength={200} />
            </Field>
            <Field label="Subtext" htmlFor="subtext" className="sm:col-span-2">
              <Input id="subtext" name="subtext" maxLength={300} />
            </Field>
            <Field label="Link label" htmlFor="ctaLabel">
              <Input id="ctaLabel" name="ctaLabel" maxLength={60} />
            </Field>
            <Field label="Link URL" htmlFor="ctaHref">
              <Input id="ctaHref" name="ctaHref" maxLength={400} placeholder="/shop" />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" disabled={pending === "new-banner"}>
                Create banner
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setCreatingBanner(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        <ul className="divide-y divide-line">
          {banners.map((banner) => (
            <li key={banner.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
              <Badge tone="quiet">{banner.placement.toLowerCase().replace(/_/g, " ")}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{banner.headline}</p>
                {banner.subtext ? <p className="truncate text-[11.5px] text-muted">{banner.subtext}</p> : null}
              </div>
              <Badge tone={banner.isActive ? "success" : "out"}>{banner.isActive ? "live" : "off"}</Badge>
              <button
                type="button"
                aria-label={`Delete banner ${banner.headline}`}
                className="text-muted hover:text-danger"
                onClick={async () => {
                  const result = await deleteBannerAction({ bannerId: banner.id });
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }
                  toast.success("Banner deleted");
                  router.refresh();
                }}
              >
                <Trash2 size={15} strokeWidth={1.6} />
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
