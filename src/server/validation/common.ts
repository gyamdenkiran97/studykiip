import { z } from "zod";

/** Shared primitives so validation rules are declared once. */

export const cuid = z.string().min(1).max(64);
export const quantity = z.number().int().min(0).max(20);
export const couponCode = z.string().trim().min(2).max(40);

export const emailSchema = z.email().max(200).transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "That password is too long.");

/**
 * Messages are written for the person filling the form, not for the developer
 * reading the stack trace. Zod's defaults ("Too small: expected string to have
 * >=2 characters") are accurate and useless to a shopper, and these now surface
 * directly beside the input they belong to.
 */
export const addressSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the full name of whoever is receiving this.")
    .max(120, "That name is too long for a delivery label."),
  company: z.string().trim().max(120, "That company name is too long.").optional().or(z.literal("")),
  line1: z
    .string()
    .trim()
    .min(2, "Enter the street address.")
    .max(160, "That address line is too long."),
  line2: z.string().trim().max(160, "That address line is too long.").optional().or(z.literal("")),
  city: z.string().trim().min(1, "Enter a town or city.").max(100, "That town or city name is too long."),
  region: z.string().trim().min(1, "Enter a county or region.").max(100, "That county or region is too long."),
  postalCode: z
    .string()
    .trim()
    .min(2, "Enter a postcode.")
    .max(24, "That postcode is too long."),
  countryCode: z.string().trim().length(2, "Choose a country.").toUpperCase(),
  phone: z.string().trim().max(32, "That phone number is too long.").optional().or(z.literal("")),
});

export type AddressInput = z.infer<typeof addressSchema>;

/** Rejects absolute URLs so a redirect parameter cannot leave the site. */
export const internalPath = z
  .string()
  .max(512)
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), "Invalid redirect target");

export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  const parsed = internalPath.safeParse(value ?? "");
  return parsed.success ? parsed.data : fallback;
}
