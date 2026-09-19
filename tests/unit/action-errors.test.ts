import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toActionError, validationError, notFound } from "@/server/errors";
import { fieldErrorsOf } from "@/lib/field-errors";

/**
 * A schema rejection is the customer's input being wrong, not the server being
 * broken. Reporting it as "something went wrong" tells someone with a mistyped
 * postcode to retry an action that will fail identically every time.
 */

const addressSchema = z.object({
  fullName: z.string().min(2, "Enter the recipient's full name."),
  postalCode: z.string().min(3, "Enter a postcode."),
  countryCode: z.string().length(2, "Choose a country."),
});

function rejection(input: unknown) {
  try {
    addressSchema.parse(input);
    throw new Error("schema unexpectedly accepted the input");
  } catch (error) {
    return toActionError(error);
  }
}

describe("toActionError", () => {
  it("reports a schema rejection as a validation failure, not an internal error", () => {
    const result = rejection({ fullName: "", postalCode: "", countryCode: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION");
    expect(result.message).not.toMatch(/something went wrong/i);
  });

  it("names every invalid field", () => {
    const result = rejection({ fullName: "A", postalCode: "X", countryCode: "GBR" });
    if (result.ok) return;
    const errors = fieldErrorsOf(result);
    expect(Object.keys(errors).sort()).toEqual(["countryCode", "fullName", "postalCode"]);
    expect(errors.postalCode).toBe("Enter a postcode.");
  });

  it("keeps only the first complaint per field", () => {
    const schema = z.object({ code: z.string().min(5, "Too short.").regex(/^\d+$/, "Digits only.") });
    let result;
    try {
      schema.parse({ code: "ab" });
      return;
    } catch (error) {
      result = toActionError(error);
    }
    if (result.ok) return;
    const errors = fieldErrorsOf(result);
    expect(Object.keys(errors)).toEqual(["code"]);
    expect(errors.code).toBe("Too short.");
  });

  it("matches the message to how many fields failed", () => {
    const one = rejection({ fullName: "Valid Name", postalCode: "LS1 1AA", countryCode: "GBR" });
    const many = rejection({ fullName: "", postalCode: "", countryCode: "" });
    if (one.ok || many.ok) return;
    expect(one.message).toMatch(/highlighted field\./);
    expect(many.message).toMatch(/highlighted fields\./);
  });

  it("passes an application error through untouched", () => {
    const result = toActionError(validationError("That code is not valid."));
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION");
    expect(result.message).toBe("That code is not valid.");

    const missing = toActionError(notFound("Order not found"));
    if (missing.ok) return;
    expect(missing.code).toBe("NOT_FOUND");
  });

  it("still hides an unexpected error behind a generic message", () => {
    // A database failure must not leak its text to the browser.
    const result = toActionError(new Error("connect ECONNREFUSED 10.0.0.3:5432"));
    if (result.ok) return;
    expect(result.code).toBe("INTERNAL");
    expect(result.message).toBe("Something went wrong. Please try again.");
    expect(JSON.stringify(result)).not.toContain("ECONNREFUSED");
  });
});

describe("fieldErrorsOf", () => {
  it("returns nothing when the result carries no field detail", () => {
    expect(fieldErrorsOf({})).toEqual({});
    expect(fieldErrorsOf({ details: {} })).toEqual({});
    expect(fieldErrorsOf({ details: { fieldErrors: null as unknown as object } })).toEqual({});
  });
});
