import { describe, expect, it } from "vitest";
import { logger } from "@/server/logger";

/**
 * The logger is the most likely place for a secret to escape by accident, so
 * redaction is tested directly rather than trusted.
 */
describe("log redaction", () => {
  const redact = (value: unknown) => logger._redact(value) as Record<string, unknown>;

  it("replaces secret-bearing keys at any depth", () => {
    const output = redact({
      email: "person@example.com",
      password: "hunter2",
      nested: { accessToken: "abc123", cardNumber: "4242424242424242" },
    });

    expect(output.email).toBe("person@example.com");
    expect(output.password).toBe("[redacted]");
    expect((output.nested as Record<string, unknown>).accessToken).toBe("[redacted]");
    expect((output.nested as Record<string, unknown>).cardNumber).toBe("[redacted]");
  });

  it("matches keys regardless of case", () => {
    const output = redact({ Password: "x", API_KEY: "y", Authorization: "Bearer z" });
    expect(Object.values(output)).toEqual(["[redacted]", "[redacted]", "[redacted]"]);
  });

  it("reduces errors to name and message, without a stack", () => {
    const output = redact({ error: new Error("boom") });
    expect(output.error).toEqual({ name: "Error", message: "boom" });
  });

  it("walks arrays", () => {
    const output = logger._redact([{ token: "a" }, { safe: "b" }]) as Array<Record<string, unknown>>;
    expect(output[0].token).toBe("[redacted]");
    expect(output[1].safe).toBe("b");
  });

  it("stops at a sensible depth rather than recursing forever", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => logger._redact(cyclic)).not.toThrow();
  });
});
