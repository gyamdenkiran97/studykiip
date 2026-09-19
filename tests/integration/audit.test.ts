import { describe, expect, it } from "vitest";
import "./helpers/setup";
import { createCustomer } from "./helpers/fixtures";
import { listAudit, recordAudit } from "@/server/audit";

describe("audit log", () => {
  it("records the actor, action and entity", async () => {
    const staff = await createCustomer({ name: "Staff Member" });

    await recordAudit({
      actor: { id: staff.id, email: staff.email },
      action: "product.updated",
      entityType: "Product",
      entityId: "product-123",
      metadata: { title: "A product" },
      ipAddress: "203.0.113.7",
    });

    const [entry] = await listAudit({ take: 1 });
    expect(entry).toMatchObject({
      action: "product.updated",
      entityType: "Product",
      entityId: "product-123",
      actorEmail: staff.email,
      ipAddress: "203.0.113.7",
    });
  });

  it("scrubs secret-looking keys before writing", async () => {
    const staff = await createCustomer();

    await recordAudit({
      actor: { id: staff.id, email: staff.email },
      action: "setting.updated",
      entityType: "SiteSetting",
      metadata: { apiKey: "sk_live_should_never_be_stored", safe: "visible" },
    });

    const [entry] = await listAudit({ take: 1 });
    expect(entry.metadata).toMatchObject({ apiKey: "[redacted]", safe: "visible" });
  });

  it("never throws into the caller when the write fails", async () => {
    // An entityId far beyond any column limit forces a database error.
    await expect(
      recordAudit({
        actor: null,
        action: "x".repeat(50_000),
        entityType: "Test",
      }),
    ).resolves.toBeUndefined();
  });

  it("returns entries newest first", async () => {
    const staff = await createCustomer();
    for (const action of ["first.action", "second.action", "third.action"]) {
      await recordAudit({ actor: { id: staff.id, email: staff.email }, action, entityType: "Test" });
    }

    const entries = await listAudit({ take: 3 });
    expect(entries[0].action).toBe("third.action");
  });
});
