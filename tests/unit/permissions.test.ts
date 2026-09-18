import { describe, expect, it } from "vitest";
import { hasPermission, isStaffRole, PERMISSIONS, permissionsForRole, USER_ROLES } from "@/server/auth/permissions";

describe("RBAC", () => {
  it("denies customers every administrative permission", () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission("CUSTOMER", permission)).toBe(false);
    }
    expect(isStaffRole("CUSTOMER")).toBe(false);
  });

  it("gives staff read access but not write access", () => {
    expect(hasPermission("STAFF", "order:read")).toBe(true);
    expect(hasPermission("STAFF", "product:read")).toBe(true);
    expect(hasPermission("STAFF", "product:write")).toBe(false);
    expect(hasPermission("STAFF", "refund:write")).toBe(false);
  });

  it("escalates permissions monotonically along the role hierarchy", () => {
    const order = ["STAFF", "MANAGER", "ADMIN", "SUPER_ADMIN"] as const;
    for (let i = 0; i < order.length - 1; i += 1) {
      const lower = permissionsForRole(order[i]);
      const higher = permissionsForRole(order[i + 1]);
      for (const permission of lower) {
        expect(higher).toContain(permission);
      }
    }
  });

  it("reserves role management for the super administrator", () => {
    expect(hasPermission("ADMIN", "user:role:write")).toBe(false);
    expect(hasPermission("SUPER_ADMIN", "user:role:write")).toBe(true);
  });

  it("honours individually granted permissions", () => {
    expect(hasPermission("STAFF", "refund:write")).toBe(false);
    expect(hasPermission("STAFF", "refund:write", ["refund:write"])).toBe(true);
  });

  it("only non-customer roles reach the admin area", () => {
    for (const role of USER_ROLES) {
      expect(hasPermission(role, "admin:access")).toBe(role !== "CUSTOMER");
    }
  });
});
