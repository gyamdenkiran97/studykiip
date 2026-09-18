import { describe, expect, it } from "vitest";
import { addressSchema, emailSchema, passwordSchema, safeRedirectPath } from "@/server/validation/common";
import { parseSectionConfig } from "@/server/validation/homepage";

describe("shared validation", () => {
  it("lowercases email addresses so duplicates cannot be created by case", () => {
    expect(emailSchema.parse("Person@Example.COM")).toBe("person@example.com");
    expect(() => emailSchema.parse("not-an-email")).toThrow();
  });

  it("requires a password long enough to be worth having", () => {
    expect(() => passwordSchema.parse("short")).toThrow();
    expect(passwordSchema.parse("a reasonable passphrase")).toBeTruthy();
  });

  it("accepts a complete address and rejects an incomplete one", () => {
    const valid = {
      fullName: "Aoife Brennan",
      line1: "14 Chandler Row",
      city: "Leeds",
      region: "West Yorkshire",
      postalCode: "LS1 4DT",
      countryCode: "gb",
    };
    expect(addressSchema.parse(valid).countryCode).toBe("GB");
    expect(() => addressSchema.parse({ ...valid, line1: "" })).toThrow();
    expect(() => addressSchema.parse({ ...valid, countryCode: "GBR" })).toThrow();
  });
});

describe("redirect safety", () => {
  it("allows same-site paths", () => {
    expect(safeRedirectPath("/account/orders")).toBe("/account/orders");
  });

  it("refuses anything that would leave the site", () => {
    expect(safeRedirectPath("https://evil.example.com")).toBe("/");
    expect(safeRedirectPath("//evil.example.com")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
  });

  it("uses the supplied fallback", () => {
    expect(safeRedirectPath("https://evil.example.com", "/checkout")).toBe("/checkout");
  });
});

describe("homepage section config", () => {
  it("parses a well-formed hero config", () => {
    const config = parseSectionConfig("HERO", {
      eyebrow: "Autumn",
      imageUrl: "/media/hero.svg",
      primaryCta: { label: "Shop", href: "/shop" },
    });
    expect(config?.primaryCta?.href).toBe("/shop");
  });

  it("returns null for a malformed config so the section renders nothing", () => {
    expect(parseSectionConfig("HERO", { primaryCta: { label: 42 } })).toBeNull();
    expect(parseSectionConfig("PRODUCT_CAROUSEL", { source: "not-a-source" })).toBeNull();
  });

  it("applies defaults for an empty config", () => {
    expect(parseSectionConfig("PRODUCT_CAROUSEL", {})).toMatchObject({ source: "featured", limit: 8 });
    expect(parseSectionConfig("CATEGORY_GRID", {})).toMatchObject({ categorySlugs: [] });
  });
});
