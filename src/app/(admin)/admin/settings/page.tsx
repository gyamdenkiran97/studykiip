import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { PageHeader, Panel } from "@/components/admin/ui";
import { SettingsForms } from "@/components/admin/settings-forms";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  await requirePermission("settings:write");

  const [settings, shippingMethods, taxClasses] = await Promise.all([
    prisma.siteSetting.findMany({ where: { key: { in: ["store", "commerce", "seo", "social"] } } }),
    prisma.shippingMethod.findMany({
      orderBy: { position: "asc" },
      include: { zone: { select: { name: true, countryCodes: true } } },
    }),
    prisma.taxClass.findMany({ orderBy: { name: "asc" } }),
  ]);

  const byKey = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));

  return (
    <>
      <PageHeader
        title="Settings"
        description="Store details, commerce defaults and SEO. Credentials live in environment variables, never here."
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <SettingsForms
          store={byKey.store as Record<string, unknown> | undefined}
          commerce={byKey.commerce as Record<string, unknown> | undefined}
          seo={byKey.seo as Record<string, unknown> | undefined}
          social={byKey.social as Record<string, unknown> | undefined}
        />

        <div className="space-y-6">
          <Panel title="Payments" description="Configured by environment, not by this screen.">
            <dl className="space-y-2 px-5 py-4 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted">Provider</dt>
                <dd className="font-mono">{env.PAYMENT_PROVIDER}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Secret key</dt>
                <dd>{env.STRIPE_SECRET_KEY ? "configured" : "not set"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Webhook secret</dt>
                <dd>{env.STRIPE_WEBHOOK_SECRET ? "configured" : "not set"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Email</dt>
                <dd>{env.RESEND_API_KEY ? "Resend" : "logging only"}</dd>
              </div>
            </dl>
            <p className="border-t border-line px-5 py-3 text-[11.5px] text-muted">
              Values are shown as configured or not — never the keys themselves.
            </p>
          </Panel>

          <Panel title="Delivery methods" description="Edit in the database or a future shipping screen.">
            <ul className="divide-y divide-line">
              {shippingMethods.map((method) => (
                <li key={method.id} className="px-5 py-3 text-[12.5px]">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{method.name}</span>
                    <span className="tabular">
                      {(method.priceCents / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" })}
                    </span>
                  </div>
                  <p className="text-muted">
                    {method.zone.name} · {method.minDeliveryDays}–{method.maxDeliveryDays} days
                    {method.freeOverCents
                      ? ` · free over ${(method.freeOverCents / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" })}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Tax classes">
            <ul className="divide-y divide-line">
              {taxClasses.map((taxClass) => (
                <li key={taxClass.id} className="flex justify-between px-5 py-3 text-[12.5px]">
                  <span>
                    {taxClass.name}
                    {taxClass.isDefault ? <span className="ml-2 text-muted">default</span> : null}
                  </span>
                  <span className="tabular">{(taxClass.rateBps / 100).toFixed(2)}%</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
