"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { saveAddressAction } from "@/server/actions/account";
import { fieldErrorsOf } from "@/lib/field-errors";

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
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
      const errors = fieldErrorsOf(result);
      setFieldErrors(errors);
      // Move focus to the summary so a keyboard or screen reader user is told
      // what happened, instead of being left wherever the submit button was.
      if (Object.keys(errors).length > 0) {
        requestAnimationFrame(() => summaryRef.current?.focus());
      }
      return;
    }
    onSaved(result.data.id);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          defaultValue={address?.fullName}
          aria-invalid={Boolean(fieldErrors.fullName)}
          aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
        />
      </Field>

      <Field label="Company (optional)" htmlFor="company">
        <Input id="company" name="company" autoComplete="organization" defaultValue={address?.company ?? ""} />
      </Field>

      <Field label="Address line 1" htmlFor="line1" error={fieldErrors.line1}>
        <Input
          id="line1"
          name="line1"
          autoComplete="address-line1"
          required
          defaultValue={address?.line1}
          aria-invalid={Boolean(fieldErrors.line1)}
          aria-describedby={fieldErrors.line1 ? "line1-error" : undefined}
        />
      </Field>

      <Field label="Address line 2 (optional)" htmlFor="line2">
        <Input id="line2" name="line2" autoComplete="address-line2" defaultValue={address?.line2 ?? ""} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Town or city" htmlFor="city" error={fieldErrors.city}>
          <Input
            id="city"
            name="city"
            autoComplete="address-level2"
            required
            defaultValue={address?.city}
            aria-invalid={Boolean(fieldErrors.city)}
            aria-describedby={fieldErrors.city ? "city-error" : undefined}
          />
        </Field>
        <Field label="County or region" htmlFor="region" error={fieldErrors.region}>
          <Input
            id="region"
            name="region"
            autoComplete="address-level1"
            required
            defaultValue={address?.region}
            aria-invalid={Boolean(fieldErrors.region)}
            aria-describedby={fieldErrors.region ? "region-error" : undefined}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Postcode" htmlFor="postalCode" error={fieldErrors.postalCode}>
          <Input
            id="postalCode"
            name="postalCode"
            autoComplete="postal-code"
            required
            defaultValue={address?.postalCode}
            aria-invalid={Boolean(fieldErrors.postalCode)}
            aria-describedby={fieldErrors.postalCode ? "postalCode-error" : undefined}
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

      <Field label="Phone (for delivery updates)" htmlFor="phone" error={fieldErrors.phone}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={address?.phone ?? ""}
          aria-invalid={Boolean(fieldErrors.phone)}
          aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
        />
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
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="border border-danger bg-danger-tint p-3 text-[13px] text-danger focus:outline-2 focus:outline-offset-2 focus:outline-danger"
        >
          <p className="font-medium">{error}</p>
          {Object.keys(fieldErrors).length > 0 ? (
            // Each item links to the field it describes, so the summary is a
            // way to reach the problem rather than just a list of complaints.
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              {Object.entries(fieldErrors).map(([field, message]) => (
                <li key={field}>
                  <a href={`#${field}`} className="underline underline-offset-2">
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
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
