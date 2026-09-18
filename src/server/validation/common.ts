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

export const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  line1: z.string().trim().min(2).max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(2).max(24),
  countryCode: z.string().trim().length(2).toUpperCase(),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
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
