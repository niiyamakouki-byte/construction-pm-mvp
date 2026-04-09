/**
 * User Roles module for GenbaHub.
 * Defines role-based access control with Japanese labels
 * for construction project management.
 */

export const UserRole = {
  owner: "owner",
  admin: "admin",
  manager: "manager",
  field_worker: "field_worker",
  viewer: "viewer",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const Action = {
  view: "view",
  edit: "edit",
  delete: "delete",
  export: "export",
  admin: "admin",
} as const;

export type Action = (typeof Action)[keyof typeof Action];

type RolePermissions = Record<UserRole, readonly Action[]>;

const ROLE_PERMISSIONS: RolePermissions = {
  owner: ["view", "edit", "delete", "export", "admin"],
  admin: ["view", "edit", "delete", "export", "admin"],
  manager: ["view", "edit", "export"],
  field_worker: ["view", "edit"],
  viewer: ["view"],
};

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "オーナー",
  admin: "管理者",
  manager: "現場監督",
  field_worker: "作業員",
  viewer: "閲覧者",
};

/**
 * Check if a given role has permission to perform an action.
 */
export function hasPermission(role: UserRole, action: Action): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(action);
}

/**
 * Get Japanese label for a role.
 */
export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: UserRole): readonly Action[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Get all available roles.
 */
export function getAllRoles(): UserRole[] {
  return Object.values(UserRole);
}
