"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

/**
 * Description, specifications and policies.
 *
 * Accordions rather than tabs: on a phone, tabs hide content behind a second
 * interaction and lose it to the fold. The first panel starts open.
 */
export function ProductDetails({
  description,
  shortDescription,
  attributes,
  variants,
  returnDays,
}: {
  description: string;
  shortDescription: string | null;
  attributes: Array<{ key: string; label: string; unit: string | null; type: string; value: string }>;
  variants: Array<{
    sku: string;
    title: string;
    weightGrams: number | null;
    lengthMm: number | null;
    widthMm: number | null;
    heightMm: number | null;
  }>;
  returnDays: number;
}) {
  const dimensioned = variants.filter(
    (variant) => variant.weightGrams || variant.lengthMm || variant.widthMm || variant.heightMm,
  );

  const format = (attribute: (typeof attributes)[number]) => {
    if (attribute.type === "BOOLEAN") return attribute.value === "true" ? "Yes" : "No";
    return attribute.unit ? `${attribute.value} ${attribute.unit}` : attribute.value;
  };

  return (
    <Accordion.Root
      type="multiple"
      defaultValue={["description"]}
      className="mt-16 divide-y divide-line border-y border-line lg:mt-24"
    >
      <Panel value="description" title="Description">
        {shortDescription ? (
          <p className="mb-4 text-[16px] leading-relaxed text-ink">{shortDescription}</p>
        ) : null}
        <p className="max-w-2xl text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">{description}</p>
      </Panel>

      {attributes.length > 0 ? (
        <Panel value="specifications" title="Specifications">
          <dl className="grid max-w-2xl gap-x-10 sm:grid-cols-2">
            {attributes.map((attribute) => (
              <div key={attribute.key} className="flex justify-between gap-6 border-b border-line py-2.5">
                <dt className="text-[13.5px] text-muted">{attribute.label}</dt>
                <dd className="text-right text-[13.5px] text-ink">{format(attribute)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}

      {dimensioned.length > 0 ? (
        <Panel value="size" title="Size &amp; weight">
          <div className="max-w-2xl overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <caption className="sr-only">Dimensions and weight by option</caption>
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Option
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Weight
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Dimensions (L × W × H)
                  </th>
                </tr>
              </thead>
              <tbody>
                {dimensioned.map((variant) => (
                  <tr key={variant.sku} className="border-b border-line">
                    <td className="py-2.5 pr-4">{variant.title}</td>
                    <td className="tabular py-2.5 pr-4">
                      {variant.weightGrams ? `${(variant.weightGrams / 1000).toFixed(2)} kg` : "—"}
                    </td>
                    <td className="tabular py-2.5">
                      {variant.lengthMm && variant.widthMm && variant.heightMm
                        ? `${variant.lengthMm} × ${variant.widthMm} × ${variant.heightMm} mm`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel value="delivery" title="Delivery &amp; returns">
        <ul className="max-w-2xl space-y-2 text-[14.5px] leading-relaxed text-ink-soft">
          <li>Standard UK delivery is 3–5 working days, and free on orders over £50.</li>
          <li>Express delivery arrives the next working day when ordered before 2pm.</li>
          <li>
            Returns are accepted for {returnDays} days from delivery, unused and in the original packaging.
          </li>
          <li>Start a return from your account — we email a label within one working day.</li>
        </ul>
      </Panel>
    </Accordion.Root>
  );
}

function Panel({
  value,
  title,
  children,
}: {
  value: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Item value={value}>
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center justify-between py-5 text-left">
          <span className="font-display text-lg">{title}</span>
          <ChevronDown
            size={18}
            strokeWidth={1.5}
            className="text-muted transition-transform duration-300 group-data-[state=open]:rotate-180"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden data-[state=closed]:animate-[fade-out_140ms_ease-in] data-[state=open]:animate-[fade-in_240ms_ease-out]">
        <div className="pb-8">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
