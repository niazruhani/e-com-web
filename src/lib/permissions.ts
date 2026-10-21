export type StaffRole = "admin" | "manager" | "support" | "fulfillment";
export type Permission =
  | "catalog:write"
  | "inventory:write"
  | "orders:read"
  | "orders:write"
  | "returns:write"
  | "content:write"
  | "staff:write";

const rolePermissions: Record<StaffRole, readonly Permission[]> = {
  admin: [
    "catalog:write",
    "inventory:write",
    "orders:read",
    "orders:write",
    "returns:write",
    "content:write",
    "staff:write",
  ],
  manager: [
    "catalog:write",
    "inventory:write",
    "orders:read",
    "orders:write",
    "returns:write",
    "content:write",
  ],
  support: ["orders:read", "returns:write"],
  fulfillment: ["inventory:write", "orders:read", "orders:write"],
};

export function hasPermission(role: string | null | undefined, permission: Permission) {
  return (
    typeof role === "string" &&
    Object.prototype.hasOwnProperty.call(rolePermissions, role) &&
    rolePermissions[role as StaffRole].includes(permission)
  );
}
