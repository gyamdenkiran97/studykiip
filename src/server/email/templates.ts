import "server-only";
import { formatMoney } from "@/lib/money";
import { detailTable, emailLayout, escapeHtml, type EmailButton } from "./layout";
import type { OutgoingEmail } from "./transport";

type Build = Omit<OutgoingEmail, "to">;

const p = (text: string) => `<p style="margin:0 0 12px 0;">${escapeHtml(text)}</p>`;

export function verifyEmailTemplate(input: { name: string; url: string }): Build {
  return {
    template: "verify-email",
    subject: "Confirm your email address",
    html: emailLayout({
      preheader: "One step to finish setting up your Kwidus21 account.",
      heading: `Welcome, ${input.name.split(" ")[0]}`,
      bodyHtml:
        p("Confirm this address and your account is ready to use.") +
        p("This link expires in one hour. If you did not create an account, you can ignore this message."),
      button: { label: "Confirm email address", href: input.url },
    }),
  };
}

export function passwordResetTemplate(input: { name: string; url: string }): Build {
  return {
    template: "password-reset",
    subject: "Reset your password",
    html: emailLayout({
      preheader: "A link to choose a new password.",
      heading: "Reset your password",
      bodyHtml:
        p(`Hello ${input.name.split(" ")[0]},`) +
        p("Use the button below to choose a new password. The link expires in one hour and can be used once.") +
        p("If you did not request this, no action is needed — your password has not changed."),
      button: { label: "Choose a new password", href: input.url },
      footerNote: "We will never ask you for your password by email.",
    }),
  };
}

export function welcomeTemplate(input: { name: string; shopUrl: string }): Build {
  return {
    template: "welcome",
    subject: "Your Kwidus21 account is ready",
    html: emailLayout({
      preheader: "Your account is ready.",
      heading: "You're in",
      bodyHtml:
        p(`Hello ${input.name.split(" ")[0]},`) +
        p("Your account is ready. You can now save products, track orders and check out faster.") +
        p("Everything in the mall — fashion, electronics, beauty, home, sport and more — is one login away."),
      button: { label: "Start browsing", href: input.shopUrl },
    }),
  };
}

type OrderLine = { title: string; variant: string; quantity: number; totalCents: number };

type OrderSummary = {
  orderNumber: string;
  currency: string;
  items: OrderLine[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  url: string;
};

function lineItems(items: OrderLine[], currency: string): string {
  return items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;font:400 13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#14120F;">
           ${escapeHtml(item.title)}<br><span style="color:#6F6759;">${escapeHtml(item.variant)} · ×${item.quantity}</span>
         </td>
         <td align="right" style="padding:8px 0;font:500 13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;">${escapeHtml(formatMoney(item.totalCents, currency))}</td></tr>`,
    )
    .join("");
}

function orderTotals(order: OrderSummary): Array<[string, string]> {
  const rows: Array<[string, string]> = [["Subtotal", formatMoney(order.subtotalCents, order.currency)]];
  if (order.discountCents > 0) rows.push(["Discount", `−${formatMoney(order.discountCents, order.currency)}`]);
  rows.push(["Shipping", order.shippingCents === 0 ? "Free" : formatMoney(order.shippingCents, order.currency)]);
  rows.push(["Tax", formatMoney(order.taxCents, order.currency)]);
  rows.push(["Total", formatMoney(order.totalCents, order.currency)]);
  return rows;
}

export function orderConfirmationTemplate(order: OrderSummary): Build {
  return {
    template: "order-confirmation",
    subject: `Order ${order.orderNumber} confirmed`,
    html: emailLayout({
      preheader: `We have your order ${order.orderNumber}.`,
      heading: "Order confirmed",
      bodyHtml:
        p(`Thank you — order ${order.orderNumber} is confirmed and moving to our warehouse.`) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${lineItems(order.items, order.currency)}</table>` +
        detailTable(orderTotals(order)),
      button: { label: "View your order", href: order.url },
    }),
  };
}

export function paymentReceiptTemplate(input: {
  orderNumber: string;
  amountCents: number;
  currency: string;
  methodBrand?: string | null;
  methodLast4?: string | null;
  url: string;
}): Build {
  const method =
    input.methodBrand && input.methodLast4
      ? `${input.methodBrand} ending ${input.methodLast4}`
      : "Card payment";
  return {
    template: "payment-receipt",
    subject: `Receipt for order ${input.orderNumber}`,
    html: emailLayout({
      preheader: `Payment received for ${input.orderNumber}.`,
      heading: "Payment received",
      bodyHtml:
        p("This is your receipt. Keep it for your records.") +
        detailTable([
          ["Order", input.orderNumber],
          ["Payment method", method],
          ["Amount paid", formatMoney(input.amountCents, input.currency)],
        ]),
      button: { label: "View your order", href: input.url },
      footerNote: "Card details are handled by our payment processor and are never stored by Kwidus21.",
    }),
  };
}

export function shipmentTemplate(input: {
  orderNumber: string;
  carrier: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  url: string;
}): Build {
  const button: EmailButton = input.trackingUrl
    ? { label: "Track your parcel", href: input.trackingUrl }
    : { label: "View your order", href: input.url };
  return {
    template: "shipment",
    subject: `Order ${input.orderNumber} is on its way`,
    html: emailLayout({
      preheader: `${input.orderNumber} has shipped.`,
      heading: "On its way",
      bodyHtml:
        p(`Order ${input.orderNumber} has left our warehouse.`) +
        detailTable([
          ["Carrier", input.carrier],
          ["Tracking number", input.trackingNumber ?? "Available shortly"],
        ]),
      button,
    }),
  };
}

export function deliveryTemplate(input: { orderNumber: string; url: string }): Build {
  return {
    template: "delivery",
    subject: `Order ${input.orderNumber} delivered`,
    html: emailLayout({
      preheader: `${input.orderNumber} has been delivered.`,
      heading: "Delivered",
      bodyHtml:
        p(`Order ${input.orderNumber} has been marked delivered.`) +
        p("If anything is not right, you can start a return from your order page."),
      button: { label: "View your order", href: input.url },
    }),
  };
}

export function cancellationTemplate(input: {
  orderNumber: string;
  reason?: string | null;
  url: string;
}): Build {
  return {
    template: "cancellation",
    subject: `Order ${input.orderNumber} cancelled`,
    html: emailLayout({
      preheader: `${input.orderNumber} has been cancelled.`,
      heading: "Order cancelled",
      bodyHtml:
        p(`Order ${input.orderNumber} has been cancelled and the reserved stock released.`) +
        (input.reason ? p(`Reason: ${input.reason}`) : "") +
        p("Any payment taken will be refunded to the original payment method."),
      button: { label: "View your order", href: input.url },
    }),
  };
}

export function refundTemplate(input: {
  orderNumber: string;
  amountCents: number;
  currency: string;
  url: string;
}): Build {
  return {
    template: "refund",
    subject: `Refund issued for order ${input.orderNumber}`,
    html: emailLayout({
      preheader: `A refund has been issued for ${input.orderNumber}.`,
      heading: "Refund issued",
      bodyHtml:
        p(`We have issued a refund of ${formatMoney(input.amountCents, input.currency)} for order ${input.orderNumber}.`) +
        p("Depending on your bank, it can take a few working days to appear on your statement."),
      button: { label: "View your order", href: input.url },
    }),
  };
}

export function returnStatusTemplate(input: {
  orderNumber: string;
  status: string;
  resolution?: string | null;
  url: string;
}): Build {
  return {
    template: "return-status",
    subject: `Return update for order ${input.orderNumber}`,
    html: emailLayout({
      preheader: `Your return for ${input.orderNumber} has been updated.`,
      heading: "Return update",
      bodyHtml:
        p(`Your return request for order ${input.orderNumber} is now: ${input.status.toLowerCase().replace(/_/g, " ")}.`) +
        (input.resolution ? p(input.resolution) : ""),
      button: { label: "View your return", href: input.url },
    }),
  };
}
