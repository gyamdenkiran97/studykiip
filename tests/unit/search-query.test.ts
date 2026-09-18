import { describe, expect, it } from "vitest";
import { normaliseQuery } from "@/server/search/engine";

describe("search query normalisation", () => {
  it("strips the wildcards that would let a visitor craft their own pattern", () => {
    expect(normaliseQuery("wool%coat")).toBe("wool coat");
    expect(normaliseQuery("wool_coat")).toBe("wool coat");
    expect(normaliseQuery("wool\\coat")).toBe("wool coat");
  });

  it("treats control characters as word separators rather than gluing words together", () => {
    expect(normaliseQuery("wool\u0000coat\u001f")).toBe("wool coat");
    expect(normaliseQuery("line\nbreak")).toBe("line break");
    expect(normaliseQuery("tab\tseparated")).toBe("tab separated");
  });

  it("collapses whitespace and trims", () => {
    expect(normaliseQuery("   wool    coat  ")).toBe("wool coat");
  });

  it("caps the length so a query cannot be used to make the database work hard", () => {
    expect(normaliseQuery("a".repeat(500))).toHaveLength(80);
  });

  it("leaves ordinary queries untouched", () => {
    expect(normaliseQuery("Lambswool Crew Neck")).toBe("Lambswool Crew Neck");
    expect(normaliseQuery("size 10 trainers")).toBe("size 10 trainers");
  });
});
