"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Lock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { CartView } from "@/server/cart";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/ui/product-image";
import { placeOrderAction } from "@/server/actions/checkout";
import { AddressForm, COUNTRIES, type AddressView } from "./address-form";

type ShippingMethodView = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  freeOverCents: number | null;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  countryCodes: string[];
};

type Step = "address" | "delivery" | "payment";

/**
 * Checkout.
 *
 * A single page with three disclosed steps rather than three navigations: the
 * basket summary stays visible throughout, and going back to change an earlier
 * answer never loses the later ones.
 *
 * No money is calculated here. The summary renders the server's cart view, and
 * the amount charged is recomputed again when the order is created.
 */
export function CheckoutFlow({
  cart,
  email,
  addresses,
  shippingMethods,
}: {
  cart: CartView;
  email: string;
  addresses: AddressView[];
  shippingMethods: ShippingMethodView[];
}) {
  const router = useRouter();

  const [step, setStep] = useState<Step>(addresses.length > 0 ? "delivery" : "address");
  const [addressList, setAddressList] = useState(addresses);
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);
  const [editingAddress, setEditingAddress] = useState<AddressView | null>(null);

  const [shippingAddressId, setShippingAddressId] = useState<string | null>(
    addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? null,
  );
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingAddressId, setBillingAddressId] = useState<string | null>(null);
  const [customerNote, setCustomerNote] = useState("");

  const shippingAddress = addressList.find((address) => address.id === shippingAddressId) ?? null;

  const availableMethods = useMemo(
    () =>
      shippingMethods.filter((method) =>
        shippingAddress ? method.countryCodes.includes(shippingAddress.countryCode) : true,
      ),
    [shippingAddress, shippingMethods],
  );

  const [shippingMethodId, setShippingMethodId] = useState<string | null>(availableMethods[0]?.id ?? null);
  const selectedMethod = availableMethods.find((method) => method.id === shippingMethodId) ?? null;

  const [placing, setPlacing] = useState(false);

  // Shipping shown before the order exists is an estimate; the order's own
  // total is authoritative and is what gets charged.
  const estimatedShipping = useMemo(() => {
    if (!selectedMethod) return 0;
    const net = cart.subtotalCents - cart.discountCents;
    if (selectedMethod.freeOverCents !== null && net >= selectedMethod.freeOverCents) return 0;
    return selectedMethod.priceCents;
  }, [cart.discountCents, cart.subtotalCents, selectedMethod]);

  const estimatedTotal = cart.subtotalCents - cart.discountCents + estimatedShipping + cart.taxCents;

  async function placeOrder() {
    if (!shippingAddressId || !shippingMethodId) return;
    setPlacing(true);

    const result = await placeOrderAction({
      shippingAddressId,
      billingAddressId: billingSameAsShipping ? shippingAddressId : (billingAddressId ?? shippingAddressId),
      shippingMethodId,
      customerNote: customerNote || undefined,
    });

    if (!result.ok) {
      setPlacing(false);
      toast.error(result.message);
      if (result.code === "OUT_OF_STOCK" || result.code === "CONFLICT") router.push("/cart");
      return;
    }

    // Stay in the pending state through the navigation: the basket has just
    // been converted, so re-rendering this page would bounce to /cart.
    router.push(`/checkout/payment/${result.data.orderId}`);
  }

  return (
    <div className="shell py-8 lg:py-12">
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-display-3">Checkout</h1>
        <p className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
          <Lock size={13} strokeWidth={1.7} aria-hidden="true" />
          Secure checkout
        </p>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
        <div className="min-w-0">
          <ol className="space-y-px">
            {/* ---------------------------------------------------- address */}
            <StepPanel
              index={1}
              title="Delivery address"
              open={step === "address"}
              complete={Boolean(shippingAddress) && step !== "address"}
              summary={
                shippingAddress
                  ? `${shippingAddress.fullName}, ${shippingAddress.line1}, ${shippingAddress.city} ${shippingAddress.postalCode}`
                  : undefined
              }
              onEdit={() => setStep("address")}
              disabled={placing}
            >
              {addressList.length > 0 && !showAddressForm ? (
                <>
                  <ul className="space-y-2.5">
                    {addressList.map((address) => (
                      <li key={address.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-3 border p-4 transition-colors",
                            shippingAddressId === address.id
                              ? "border-ink bg-surface"
                              : "border-line hover:border-line-strong",
                          )}
                        >
                          <input
                            type="radio"
                            name="shippingAddress"
                            value={address.id}
                            checked={shippingAddressId === address.id}
                            onChange={() => setShippingAddressId(address.id)}
                            className="mt-1 h-4 w-4 shrink-0 appearance-none rounded-full border border-line-strong checked:border-6 checked:border-ink"
                          />
                          <span className="text-[13.5px] leading-relaxed">
                            <span className="block font-medium text-ink">{address.fullName}</span>
                            <span className="block text-muted">
                              {[address.line1, address.line2, address.city, address.region, address.postalCode]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                            <span className="block text-muted">
                              {COUNTRIES.find((country) => country.code === address.countryCode)?.name ??
                                address.countryCode}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              setEditingAddress(address);
                              setShowAddressForm(true);
                            }}
                            className="ml-auto text-muted hover:text-ink"
                            aria-label={`Edit address for ${address.fullName}`}
                          >
                            <Pencil size={14} strokeWidth={1.6} />
                          </button>
                        </label>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingAddress(null);
                        setShowAddressForm(true);
                      }}
                    >
                      Add a new address
                    </Button>
                    <Button disabled={!shippingAddressId} onClick={() => setStep("delivery")}>
                      Continue to delivery
                    </Button>
                  </div>
                </>
              ) : (
                <AddressForm
                  address={editingAddress}
                  onSaved={(id) => {
                    setShowAddressForm(false);
                    setEditingAddress(null);
                    setShippingAddressId(id);
                    // Refresh the server-rendered address list.
                    router.refresh();
                    // Optimistically reflect the change without waiting.
                    setAddressList((current) =>
                      current.some((address) => address.id === id)
                        ? current
                        : [
                            ...current,
                            {
                              id,
                              type: "SHIPPING",
                              fullName: "New address",
                              company: null,
                              line1: "Saved",
                              line2: null,
                              city: "",
                              region: "",
                              postalCode: "",
                              countryCode: "GB",
                              phone: null,
                              isDefault: false,
                            },
                          ],
                    );
                    setStep("delivery");
                  }}
                  onCancel={addressList.length > 0 ? () => setShowAddressForm(false) : undefined}
                />
              )}
            </StepPanel>

            {/* --------------------------------------------------- delivery */}
            <StepPanel
              index={2}
              title="Delivery method"
              open={step === "delivery"}
              complete={Boolean(selectedMethod) && step === "payment"}
              summary={selectedMethod ? `${selectedMethod.name} · ${formatMoney(estimatedShipping, cart.currency)}` : undefined}
              onEdit={() => setStep("delivery")}
              disabled={placing}
            >
              {availableMethods.length === 0 ? (
                <p className="text-[13.5px] text-danger">
                  We do not currently deliver to that country. Choose another address.
                </p>
              ) : (
                <>
                  <ul className="space-y-2.5">
                    {availableMethods.map((method) => {
                      const free =
                        method.freeOverCents !== null &&
                        cart.subtotalCents - cart.discountCents >= method.freeOverCents;
                      return (
                        <li key={method.id}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-3 border p-4 transition-colors",
                              shippingMethodId === method.id
                                ? "border-ink bg-surface"
                                : "border-line hover:border-line-strong",
                            )}
                          >
                            <input
                              type="radio"
                              name="shippingMethod"
                              value={method.id}
                              checked={shippingMethodId === method.id}
                              onChange={() => setShippingMethodId(method.id)}
                              className="h-4 w-4 shrink-0 appearance-none rounded-full border border-line-strong checked:border-6 checked:border-ink"
                            />
                            <span className="flex-1 text-[13.5px]">
                              <span className="block font-medium">{method.name}</span>
                              <span className="block text-muted">
                                {method.description ??
                                  `${method.minDeliveryDays}–${method.maxDeliveryDays} working days`}
                              </span>
                            </span>
                            <span className="tabular text-[13.5px] font-medium">
                              {free ? "Free" : formatMoney(method.priceCents, cart.currency)}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-5">
                    <label htmlFor="note" className="text-[13px] font-medium text-ink-soft">
                      Delivery note (optional)
                    </label>
                    <textarea
                      id="note"
                      value={customerNote}
                      onChange={(event) => setCustomerNote(event.target.value.slice(0, 500))}
                      rows={2}
                      placeholder="Leave with a neighbour, gate code, and so on"
                      className="mt-1.5 w-full border border-line-strong bg-surface px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2.5 text-[13.5px] text-ink-soft">
                      <input
                        type="checkbox"
                        checked={billingSameAsShipping}
                        onChange={(event) => setBillingSameAsShipping(event.target.checked)}
                        className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
                      />
                      Billing address is the same as delivery
                    </label>
                  </div>

                  {!billingSameAsShipping ? (
                    <div className="mt-3">
                      <label htmlFor="billing" className="text-[13px] font-medium text-ink-soft">
                        Billing address
                      </label>
                      <select
                        id="billing"
                        value={billingAddressId ?? ""}
                        onChange={(event) => setBillingAddressId(event.target.value || null)}
                        className="mt-1.5 h-11 w-full border border-line-strong bg-surface px-3 text-sm focus:border-ink focus:outline-none"
                      >
                        <option value="">Choose an address</option>
                        {addressList.map((address) => (
                          <option key={address.id} value={address.id}>
                            {address.fullName} — {address.line1}, {address.postalCode}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <Button className="mt-5" disabled={!shippingMethodId} onClick={() => setStep("payment")}>
                    Continue to payment
                  </Button>
                </>
              )}
            </StepPanel>

            {/* ---------------------------------------------------- payment */}
            <StepPanel
              index={3}
              title="Payment"
              open={step === "payment"}
              complete={false}
              onEdit={() => setStep("payment")}
              disabled={false}
            >
              <>
                  <p className="text-[13.5px] leading-relaxed text-muted">
                    Your order is created first so the amount you are charged is calculated by us, not sent
                    from your browser. Card details are entered on the payment provider's own form and never
                    reach our servers.
                  </p>
                  <div className="mt-5 rounded-xs border border-line bg-paper-deep p-4">
                    <dl className="space-y-1.5 text-[13.5px]">
                      <div className="flex justify-between">
                        <dt className="text-muted">Sending to</dt>
                        <dd>{email}</dd>
                      </div>
                      {shippingAddress ? (
                        <div className="flex justify-between gap-6">
                          <dt className="text-muted">Delivery</dt>
                          <dd className="text-right">{shippingAddress.postalCode}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                  <Button
                    size="lg"
                    full
                    className="mt-5"
                    disabled={placing || !shippingAddressId || !shippingMethodId || cart.hasIssues}
                    onClick={placeOrder}
                  >
                    {placing ? "Creating your order…" : `Place order · ${formatMoney(estimatedTotal, cart.currency)}`}
                  </Button>
                  <p className="mt-2.5 text-center text-[12px] text-muted">
                    You will confirm payment in the next step. Nothing is charged until then.
                  </p>
                </>
            </StepPanel>
          </ol>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-labelledby="order-summary">
          <div className="border border-line bg-surface p-6">
            <h2 id="order-summary" className="font-display text-lg">
              Order summary
            </h2>

            <ul className="mt-5 max-h-72 space-y-3.5 overflow-y-auto">
              {cart.lines.map((line) => (
                <li key={line.id} className="flex gap-3">
                  <span className="relative block h-16 w-13 shrink-0 overflow-hidden bg-paper-deep">
                    <ProductImage src={line.imageUrl} alt="" sizes="52px" />
                    <span className="tabular absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center bg-ink px-1 text-[10px] text-paper">
                      {line.quantity}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 text-[13px]">
                    <span className="block truncate font-medium">{line.title}</span>
                    {line.variantTitle !== "Standard" ? (
                      <span className="block truncate text-muted">{line.variantTitle}</span>
                    ) : null}
                  </span>
                  <span className="tabular text-[13px]">{formatMoney(line.lineSubtotalCents, cart.currency)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular">{formatMoney(cart.subtotalCents, cart.currency)}</dd>
              </div>
              {cart.discountCents > 0 ? (
                <div className="flex justify-between text-clay">
                  <dt>Discount {cart.coupon ? `(${cart.coupon.code})` : ""}</dt>
                  <dd className="tabular">−{formatMoney(cart.discountCents, cart.currency)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted">Delivery</dt>
                <dd className="tabular">
                  {selectedMethod
                    ? estimatedShipping === 0
                      ? "Free"
                      : formatMoney(estimatedShipping, cart.currency)
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Tax</dt>
                <dd className="tabular">{formatMoney(cart.taxCents, cart.currency)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-display text-base">Total</dt>
                <dd className="tabular font-display text-lg">{formatMoney(estimatedTotal, cart.currency)}</dd>
              </div>
            </dl>

            <p className="mt-4 text-[12px] text-muted">
              <Link href="/cart" className="underline underline-offset-4 hover:text-ink">
                Edit your basket
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StepPanel({
  index,
  title,
  open,
  complete,
  summary,
  onEdit,
  disabled,
  children,
}: {
  index: number;
  title: string;
  open: boolean;
  complete: boolean;
  summary?: string;
  onEdit: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="border-b border-line py-6 first:border-t">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "tabular grid h-7 w-7 shrink-0 place-items-center text-[12px] font-semibold",
            complete ? "bg-success text-paper" : open ? "bg-ink text-paper" : "bg-paper-deep text-muted",
          )}
          aria-hidden="true"
        >
          {complete ? <Check size={14} strokeWidth={2.4} /> : index}
        </span>
        <h2 className="font-display text-lg">{title}</h2>
        {!open && complete && !disabled ? (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto text-[13px] text-muted underline underline-offset-4 hover:text-ink"
          >
            Change
          </button>
        ) : null}
      </div>

      {!open && summary ? <p className="mt-2 pl-10 text-[13.5px] text-muted">{summary}</p> : null}
      {open ? <div className="mt-5 pl-0 sm:pl-10">{children}</div> : null}
    </li>
  );
}
