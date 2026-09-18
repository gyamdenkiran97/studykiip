/**
 * Role-based access control.
 *
 * Roles are coarse and hierarchical; permissions are the fine-grained unit that
 * every server-side guard actually checks. UI visibility is never the control —
 * it mirrors these same checks so the two cannot drift.
 *
 * This module is intentionally dependency-free so it can be unit tested and
 * imported from client components for rendering decisions.
 */

export const USER_ROLES = ["CUSTOMER", "STAFF", "MANAGER", "ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof USER_ROLES)[number];

export const PERMISSIONS = [
  "admin:access",
  "dashboard:read",
  "product:read",
  "product:write",
  "product:delete",
  "category:write",
  "brand:write",
  "inventory:read",
  "inventory:write",
  "order:read",
  "order:write",
  "order:cancel",
  "payment:read",
  "refund:write",
  "customer:read",
  "customer:write",
  "promotion:write",
  "content:write",
  "review:moderate",
  "settings:write",
  "audit:read",
  "user:role:write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const STAFF: Permission[] = [
  "admin:access",
  "dashboard:read",
  "product:read",
  "inventory:read",
  "order:read",
  "customer:read",
  "payment:read",
];

const MANAGER: Permission[] = [
  ...STAFF,
  "product:write",
  "category:write",
  "brand:write",
  "inventory:write",
  "order:write",
  "order:cancel",
  "promotion:write",
  "content:write",
  "review:moderate",
  "customer:write",
];

const ADMIN: Permission[] = [...MANAGER, "product:delete", "refund:write", "settings:write", "audit:read"];

const SUPER_ADMIN: Permission[] = [...ADMIN, "user:role:write"];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  CUSTOMER: [],
  STAFF: STAFF,
  MANAGER: MANAGER,
  ADMIN: ADMIN,
  SUPER_ADMIN: SUPER_ADMIN,
};

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * @param extraGrants individually granted permissions from the UserPermission
 *                    table, layered on top of the role's baseline.
 */
export function hasPermission(
  role: Role,
  permission: Permission,
  extraGrants: readonly string[] = [],
): boolean {
  return permissionsForRole(role).includes(permission) || extraGrants.includes(permission);
}

export function isStaffRole(role: Role): boolean {
  return role !== "CUSTOMER";
}

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: "Customer",
  STAFF: "Staff",
  MANAGER: "Manager",
  ADMIN: "Administrator",
  SUPER_ADMIN: "Super administrator",
};
