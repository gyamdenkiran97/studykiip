"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Panel } from "./ui";
import { saveSettingAction } from "@/server/actions/admin/marketing";

/** Store settings, grouped by concern so one save cannot corrupt another group. */
export function SettingsForms({
  store,
  commerce,
  seo,
  social,
}: {
  store?: Record<string, unknown>;
  commerce?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  social?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function save(key: string, value: unknown) {
    setPending(key);
    const result = await saveSettingAction({ key, value });
    setPending(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Settings saved");
    router.refresh();
  }

  const str = (source: Record<string, unknown> | undefined, key: string, fallback = "") =>
    typeof source?.[key] === "string" ? (source[key] as string) : fallback;
  const num = (source: Record<string, unknown> | undefined, key: string, fallback = 0) =>
    typeof source?.[key] === "number" ? (source[key] as number) : fallback;

  return (
    <div className="space-y-6">
      <Panel title="Store">
        <form
          className="grid gap-4 px-5 py-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void save("store", {
              name: String(formData.get("name") ?? ""),
              tagline: String(formData.get("tagline") ?? ""),
              supportEmail: String(formData.get("supportEmail") ?? ""),
              supportPhone: String(formData.get("supportPhone") ?? ""),
              addressLines: String(formData.get("addressLines") ?? "")
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
              companyNumber: String(formData.get("companyNumber") ?? ""),
            });
          }}
        >
          <Field label="Store name" htmlFor="name">
            <Input id="name" name="name" defaultValue={str(store, "name", "Kiip Mall")} required maxLength={120} />
          </Field>
          <Field label="Tagline" htmlFor="tagline">
            <Input id="tagline" name="tagline" defaultValue={str(store, "tagline")} maxLength={200} />
          </Field>
          <Field label="Support email" htmlFor="supportEmail">
            <Input id="supportEmail" name="supportEmail" type="email" defaultValue={str(store, "supportEmail")} required />
          </Field>
          <Field label="Support phone" htmlFor="supportPhone">
            <Input id="supportPhone" name="supportPhone" defaultValue={str(store, "supportPhone")} maxLength={40} />
          </Field>
          <Field label="Registered address" htmlFor="addressLines" className="sm:col-span-2" hint="One line per row.">
            <Textarea
              id="addressLines"
              name="addressLines"
              rows={4}
              defaultValue={(Array.isArray(store?.addressLines) ? (store.addressLines as string[]) : []).join("\n")}
            />
          </Field>
          <Field label="Company number" htmlFor="companyNumber" hint="Required on invoices before launch.">
            <Input id="companyNumber" name="companyNumber" defaultValue={str(store, "companyNumber")} maxLength={60} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={pending === "store"}>
              Save store details
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title="Commerce">
        <form
          className="grid gap-4 px-5 py-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void save("commerce", {
              currency: String(formData.get("currency") ?? "GBP").toUpperCase(),
              locale: String(formData.get("locale") ?? "en-GB"),
              defaultCountry: String(formData.get("defaultCountry") ?? "GB").toUpperCase(),
              freeShippingThresholdCents: Math.round(Number(formData.get("freeShipping") ?? 0) * 100),
              returnWindowDays: Number(formData.get("returnWindowDays") ?? 30),
            });
          }}
        >
          <Field label="Currency" htmlFor="currency" hint="ISO-4217 code.">
            <Input id="currency" name="currency" defaultValue={str(commerce, "currency", "GBP")} maxLength={3} required />
          </Field>
          <Field label="Locale" htmlFor="locale">
            <Input id="locale" name="locale" defaultValue={str(commerce, "locale", "en-GB")} maxLength={10} required />
          </Field>
          <Field label="Default country" htmlFor="defaultCountry">
            <Input
              id="defaultCountry"
              name="defaultCountry"
              defaultValue={str(commerce, "defaultCountry", "GB")}
              maxLength={2}
              required
            />
          </Field>
          <Field label="Free delivery over (£)" htmlFor="freeShipping">
            <Input
              id="freeShipping"
              name="freeShipping"
              inputMode="decimal"
              defaultValue={(num(commerce, "freeShippingThresholdCents", 5000) / 100).toFixed(2)}
            />
          </Field>
          <Field label="Return window (days)" htmlFor="returnWindowDays">
            <Input
              id="returnWindowDays"
              name="returnWindowDays"
              inputMode="numeric"
              defaultValue={num(commerce, "returnWindowDays", 30)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={pending === "commerce"}>
              Save commerce settings
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title="SEO &amp; social">
        <form
          className="grid gap-4 px-5 py-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void save("seo", {
              titleTemplate: String(formData.get("titleTemplate") ?? "%s | Kiip Mall"),
              defaultDescription: String(formData.get("defaultDescription") ?? ""),
              twitterHandle: String(formData.get("twitterHandle") ?? ""),
            });
          }}
        >
          <Field label="Title template" htmlFor="titleTemplate" hint="Use %s for the page title.">
            <Input
              id="titleTemplate"
              name="titleTemplate"
              defaultValue={str(seo, "titleTemplate", "%s | Kiip Mall")}
              maxLength={120}
            />
          </Field>
          <Field label="Social handle" htmlFor="twitterHandle">
            <Input id="twitterHandle" name="twitterHandle" defaultValue={str(seo, "twitterHandle")} maxLength={40} />
          </Field>
          <Field label="Default description" htmlFor="defaultDescription" className="sm:col-span-2">
            <Textarea
              id="defaultDescription"
              name="defaultDescription"
              rows={3}
              defaultValue={str(seo, "defaultDescription")}
              maxLength={400}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={pending === "seo"}>
              Save SEO settings
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
