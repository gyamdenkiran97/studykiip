import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { FaqAccordion } from "@/components/storefront/faq-accordion";

export const metadata: Metadata = {
  title: "Frequently asked",
  description: "Answers to the questions we are asked most about ordering, delivery, returns and accounts.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "commerce" } });
  const commerce = (setting?.value ?? {}) as { returnWindowDays?: number; freeShippingThresholdCents?: number };
  const returnDays = commerce.returnWindowDays ?? 30;
  const freeOver = ((commerce.freeShippingThresholdCents ?? 5000) / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
  });

  const groups = [
    {
      title: "Ordering",
      items: [
        {
          question: "Do I need an account to buy something?",
          answer:
            "Yes, to check out. You can browse, search and fill a basket without one, but an order needs an owner so it can be tracked, returned and refunded.",
        },
        {
          question: "Is the stock shown on a product page real?",
          answer:
            "It is. The number shown is physical stock minus what is already reserved for other people's open orders, so two people cannot buy the same last item.",
        },
        {
          question: "Can I change or cancel an order?",
          answer:
            "An order that has not shipped can be cancelled from your account, which releases the stock immediately and refunds any payment. After it ships, use the returns process instead.",
        },
      ],
    },
    {
      title: "Delivery",
      items: [
        {
          question: "How much is delivery?",
          answer: `Standard UK delivery is free over ${freeOver}, and charged at the rate shown at checkout below that. Express and international options are priced on the delivery page.`,
        },
        {
          question: "Where is my order?",
          answer:
            "Every order has a page in your account showing its status and, once dispatched, the carrier and tracking number.",
        },
      ],
    },
    {
      title: "Returns and refunds",
      items: [
        {
          question: "How long do I have to return something?",
          answer: `${returnDays} days from delivery, unused and in its original packaging. Faulty or incorrect items can be returned at our cost at any reasonable time.`,
        },
        {
          question: "When do I get my money back?",
          answer:
            "We refund to the original payment method once the return arrives and has been checked. Banks typically take three to five working days after that to show it.",
        },
      ],
    },
    {
      title: "Accounts and privacy",
      items: [
        {
          question: "Do you store my card details?",
          answer:
            "No. Card details are entered on the payment provider's own form and never reach our servers. We keep the provider's transaction reference, the card brand and the last four digits so we can match a payment to an order.",
        },
        {
          question: "How do I delete my account?",
          answer:
            "Contact us and we will remove the personal data we are not legally required to keep. Order and payment records have to be retained for accounting and tax purposes.",
        },
      ],
    },
  ];

  return (
    <div className="shell py-12 lg:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-display-2">Frequently asked</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          If the answer is not here,{" "}
          <Link href="/contact" className="underline underline-offset-4 hover:text-ink">
            ask us
          </Link>{" "}
          — a person replies within one working day.
        </p>

        <div className="mt-12 space-y-12">
          {groups.map((group) => (
            <section key={group.title} aria-labelledby={`faq-${group.title}`}>
              <h2 id={`faq-${group.title}`} className="eyebrow mb-4">
                {group.title}
              </h2>
              <FaqAccordion items={group.items} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
