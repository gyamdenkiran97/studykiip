"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { saveAddressAction } from "@/server/actions/account";

export type AddressView = {
  id: string;
  type: "SHIPPING" | "BILLING";
  fullName: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phone: string | null;
  isDefault: boolean;
};

/** Countries we currently ship to. Extended by the admin shipping zones. */
export const COUNTRIES = [
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
];

export function AddressForm({
  address,
  type = "SHIPPING",
  onSaved,
  onCancel,
  submitLabel = "Save address",
}: {
  address?: AddressView | null;
  type?: "SHIPPING" | "BILLING";
  onSaved: (id: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    setPending(true);

    const result = await saveAddressAction({
      id: address?.id,
      type,
      isDefault: formData.get("isDefault") === "on",
      fullName: String(formData.get("fullName") ?? ""),
      company: String(formData.get("company") ?? ""),
      line1: String(formData.get("line1") ?? ""),
      line2: String(formData.get("line2") ?? ""),
      city: String(formData.get("city") ?? ""),
      region: String(formData.get("region") ?? ""),
      postalCode: String(formData.get("postalCode") ?? ""),
      countryCode: String(formData.get("countryCode") ?? "GB"),
      phone: String(formData.get("phone") ?? ""),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved(result.data.id);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Full name" htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={address?.fullName} />
      </Field>

      <Field label="Company (optional)" htmlFor="company">
        <Input id="company" name="company" autoComplete="organization" defaultValue={address?.company ?? ""} />
      </Field>

      <Field label="Address line 1" htmlFor="line1">
        <Input id="line1" name="line1" autoComplete="address-line1" required defaultValue={address?.line1} />
      </Field>

      <Field label="Address line 2 (optional)" htmlFor="line2">
        <Input id="line2" name="line2" autoComplete="address-line2" defaultValue={address?.line2 ?? ""} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Town or city" htmlFor="city">
          <Input id="city" name="city" autoComplete="address-level2" required defaultValue={address?.city} />
        </Field>
        <Field label="County or region" htmlFor="region">
          <Input id="region" name="region" autoComplete="address-level1" required defaultValue={address?.region} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Postcode" htmlFor="postalCode">
          <Input
            id="postalCode"
            name="postalCode"
            autoComplete="postal-code"
            required
            defaultValue={address?.postalCode}
          />
        </Field>
        <Field label="Country" htmlFor="countryCode">
          <Select id="countryCode" name="countryCode" defaultValue={address?.countryCode ?? "GB"}>
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Phone (for delivery updates)" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={address?.phone ?? ""} />
      </Field>

      <label className="flex items-center gap-2.5 text-[13.5px] text-ink-soft">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={address?.isDefault}
          className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
        />
        Use as my default {type === "SHIPPING" ? "delivery" : "billing"} address
      </label>

      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
