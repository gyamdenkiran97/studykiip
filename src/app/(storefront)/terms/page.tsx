import type { Metadata } from "next";
import { LegalPage } from "@/components/storefront/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms on which Kiip Mall sells to you.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated={new Date().toISOString()}
      intro="The agreement between you and the store when you buy something here."
    >
      <h2>These terms</h2>
      <p>
        By placing an order you agree to these terms. They apply alongside our privacy, delivery and returns
        pages, which form part of the same agreement.
      </p>

      <h2>Your account</h2>
      <p>
        You need an account to check out, so that your order can be tracked, returned and refunded. Keep your
        password to yourself; you are responsible for what happens under your account. Tell us immediately if
        you think someone else has access to it.
      </p>

      <h2>Orders and acceptance</h2>
      <p>
        Adding an item to your basket does not reserve it. A contract is formed when we confirm your order
        after payment has been taken. If an item turns out to be unavailable or mispriced after you order, we
        will contact you and either refund you or, with your agreement, substitute or amend the order.
      </p>

      <h2>Prices and payment</h2>
      <p>
        Prices are shown including VAT where it applies, with delivery added at checkout. The amount charged is
        calculated by us from the order, never sent from your browser. Payment is taken by a third-party
        payment provider; card details never reach our systems.
      </p>

      <h2>Discount codes</h2>
      <p>
        Codes apply only to the items and conditions attached to them, cannot be exchanged for cash, and can be
        withdrawn at any time. We may refuse a code that appears to have been obtained or used abusively.
      </p>

      <h2>Reviews and content you submit</h2>
      <p>
        Reviews are moderated before they appear. Please write about the product and your experience of it. We
        will not publish anything unlawful, abusive, or written to promote something else, and we may remove a
        review that breaches this.
      </p>

      <h2>Availability of the site</h2>
      <p>
        We aim to keep the store available, but we do not guarantee uninterrupted access. We may change or
        withdraw products, features and prices.
      </p>

      <h2>Liability</h2>
      <p>
        Nothing in these terms limits liability that cannot be limited by law, including for death or personal
        injury caused by negligence, or for fraud. Subject to that, the specific limitations, the governing
        law and the courts with jurisdiction depend on the real trading entity and must be settled with a
        qualified adviser before this store trades.
      </p>
    </LegalPage>
  );
}
