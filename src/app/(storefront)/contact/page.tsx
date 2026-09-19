import type { Metadata } from "next";
import { Mail, MessageSquare, Phone } from "lucide-react";
import { prisma } from "@/server/db";
import { ContactForm } from "@/components/storefront/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach Kwidus21 about an order, a return or anything else.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "store" } });
  const store = (setting?.value ?? {}) as { supportEmail?: string; supportPhone?: string; addressLines?: string[] };

  return (
    <div className="shell py-12 lg:py-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_360px] lg:gap-20">
        <div className="max-w-xl">
          <h1 className="text-display-2">Contact us</h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            A real person answers within one working day. If your question is about an order, including the
            order number gets you a faster answer.
          </p>
          <div className="mt-10">
            <ContactForm />
          </div>
        </div>

        <aside className="space-y-8 lg:border-l lg:border-line lg:pl-12">
          <div>
            <h2 className="eyebrow mb-3">Direct</h2>
            <ul className="space-y-3 text-[14px]">
              {store.supportEmail ? (
                <li className="flex items-center gap-2.5">
                  <Mail size={16} strokeWidth={1.6} className="text-muted" aria-hidden="true" />
                  <a href={`mailto:${store.supportEmail}`} className="underline underline-offset-4 hover:text-clay">
                    {store.supportEmail}
                  </a>
                </li>
              ) : null}
              {store.supportPhone ? (
                <li className="flex items-center gap-2.5">
                  <Phone size={16} strokeWidth={1.6} className="text-muted" aria-hidden="true" />
                  <span>{store.supportPhone}</span>
                </li>
              ) : null}
              <li className="flex items-center gap-2.5">
                <MessageSquare size={16} strokeWidth={1.6} className="text-muted" aria-hidden="true" />
                <span className="text-muted">Monday to Friday, 9am–5pm</span>
              </li>
            </ul>
          </div>

          {store.addressLines?.length ? (
            <div>
              <h2 className="eyebrow mb-3">Registered address</h2>
              <address className="text-[13.5px] leading-relaxed text-muted not-italic">
                {store.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
              <p className="mt-3 text-[12px] text-muted-soft">
                Placeholder details for this demonstration store.
              </p>
            </div>
          ) : null}

          <div>
            <h2 className="eyebrow mb-3">Before you write</h2>
            <ul className="space-y-2 text-[13.5px] text-muted">
              <li>
                Tracking and order status live on the order page in your account — usually faster than asking.
              </li>
              <li>Returns can be started from the same page without contacting us first.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
