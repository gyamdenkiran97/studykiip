import type { Metadata } from "next";
import { LegalPage } from "@/components/storefront/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What data Kiip Mall collects, why, and what you can ask us to do with it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated={new Date().toISOString()}
      intro="What we collect, why we collect it, and how to get it changed or removed."
    >
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details.</strong> Your name, email address and — if you give it — a phone number for
          delivery updates.
        </li>
        <li>
          <strong>Order details.</strong> What you bought, the delivery and billing addresses you supplied, and
          the status of the order.
        </li>
        <li>
          <strong>Payment references.</strong> The payment provider's identifier for the transaction, the card
          brand and the last four digits. <strong>We never receive or store your full card number.</strong>
        </li>
        <li>
          <strong>Activity on the site.</strong> Your basket, wishlist, recently viewed products and searches,
          so the store works as you would expect between visits.
        </li>
        <li>
          <strong>Technical data.</strong> Your IP address and browser user agent, recorded with sessions and
          security events to detect abuse.
        </li>
      </ul>

      <h2>Why we collect it</h2>
      <p>
        To take and fulfil your order, to provide an account you can use to track and return it, to prevent
        fraud and abuse, and to comply with the record-keeping the law requires of a retailer. We send
        marketing email only if you have asked for it, and every such email can be unsubscribed in one click.
      </p>

      <h2>Cookies</h2>
      <ul>
        <li>
          <strong>Session cookie.</strong> Keeps you signed in. Strictly necessary; the site cannot work
          without it.
        </li>
        <li>
          <strong>Basket cookie.</strong> A random token that connects you to your basket before you sign in.
          It holds no personal data by itself.
        </li>
      </ul>
      <p>
        Both are HttpOnly (JavaScript cannot read them), SameSite=Lax (they are not sent from other sites) and,
        in production, Secure (sent over HTTPS only).
      </p>

      <h2>Who else sees your data</h2>
      <p>
        Only the processors needed to run the shop: the payment provider (to take payment), the delivery
        carrier (name and address, to deliver), and the email provider (to send order emails). We do not sell
        your data, and we do not share it for other companies' marketing.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Order and payment records are kept for as long as accounting and tax rules require. Account data is
        kept while your account is open. Baskets, recently viewed items and search logs are pruned routinely
        because they stop being useful quickly.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us for a copy of your data, to correct it, to delete it, or to stop using it for marketing.
        Most of it you can change yourself from your account. For anything else, contact us and we will respond
        within one month.
      </p>
      <p>
        The precise legal bases, the identity of the data controller and the supervisory authority you may
        complain to all depend on the real trading entity and jurisdiction, and must be completed before this
        store goes live.
      </p>
    </LegalPage>
  );
}
