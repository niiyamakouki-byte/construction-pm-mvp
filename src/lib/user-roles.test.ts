import { describe, expect, it } from "vitest";
import {
  UserRole,
  Action,
  hasPermission,
  getRoleLabel,
  getPermissions,
  getAllRoles,
} from "./user-roles.js";

describe("user-roles", () => {
  describe("hasPermission", () => {
    it("owner has all permissions", () => {
      expect(hasPermission("owner", "view")).toBe(true);
      expect(hasPermission("owner", "edit")).toBe(true);
      expect(hasPermission("owner", "delete")).toBe(true);
      expect(hasPermission("owner", "export")).toBe(true);
      expect(hasPermission("owner", "admin")).toBe(true);
    });

    it("admin has all permissions", () => {
      expect(hasPermission("admin", "view")).toBe(true);
      expect(hasPermission("admin", "edit")).toBe(true);
      expect(hasPermission("admin", "delete")).toBe(true);
      expect(hasPermission("admin", "export")).toBe(true);
      expect(hasPermission("admin", "admin")).toBe(true);
    });

    it("manager can view, edit, export but not delete or admin", () => {
      expect(hasPermission("manager", "view")).toBe(true);
      expect(hasPermission("manager", "edit")).toBe(true);
      expect(hasPermission("manager", "export")).toBe(true);
      expect(hasPermission("manager", "delete")).toBe(false);
      expect(hasPermission("manager", "admin")).toBe(false);
    });

    it("field_worker can only view and edit", () => {
      expect(hasPermission("field_worker", "view")).toBe(true);
      expect(hasPermission("field_worker", "edit")).toBe(true);
      expect(hasPermission("field_worker", "delete")).toBe(false);
      expect(hasPermission("field_worker", "export")).toBe(false);
      expect(hasPermission("field_worker", "admin")).toBe(false);
    });

    it("viewer can only view", () => {
      expect(hasPermission("viewer", "view")).toBe(true);
      expect(hasPermission("viewer", "edit")).toBe(false);
      expect(hasPermission("viewer", "delete")).toBe(false);
      expect(hasPermission("viewer", "export")).toBe(false);
      expect(hasPermission("viewer", "admin")).toBe(false);
    });

    it("returns false for unknown role", () => {
      expect(hasPermission("unknown" as UserRole, "view")).toBe(false);
    });
  });

  describe("getRoleLabel", () => {
    it("returns Japanese label for owner", () => {
      expect(getRoleLabel("owner")).toBe("オーナー");
    });

    it("returns Japanese label for admin", () => {
      expect(getRoleLabel("admin")).toBe("管理者");
    });

    it("returns Japanese label for manager", () => {
      expect(getRoleLabel("manager")).toBe("現場監督");
    });

    it("returns Japanese label for field_worker", () => {
      expect(getRoleLabel("field_worker")).toBe("作業員");
    });

    it("returns Japanese label for viewer", () => {
      expect(getRoleLabel("viewer")).toBe("閲覧者");
    });
  });

  describe("getPermissions", () => {
    it("returns all 5 actions for owner", () => {
      const perms = getPermissions("owner");
      expect(perms).toHaveLength(5);
      expect(perms).toContain("view");
      expect(perms).toContain("admin");
    });

    it("returns 2 actions for field_worker", () => {
      const perms = getPermissions("field_worker");
      expect(perms).toHaveLength(2);
      expect(perms).toContain("view");
      expect(perms).toContain("edit");
    });

    it("returns 1 action for viewer", () => {
      const perms = getPermissions("viewer");
      expect(perms).toHaveLength(1);
      expect(perms).toContain("view");
    });

    it("returns empty array for unknown role", () => {
      expect(getPermissions("unknown" as UserRole)).toEqual([]);
    });
  });

  describe("getAllRoles", () => {
    it("returns all 5 roles", () => {
      const roles = getAllRoles();
      expect(roles).toHaveLength(5);
      expect(roles).toContain("owner");
      expect(roles).toContain("admin");
      expect(roles).toContain("manager");
      expect(roles).toContain("field_worker");
      expect(roles).toContain("viewer");
    });
  });

  describe("constants", () => {
    it("UserRole has all expected keys", () => {
      expect(UserRole.owner).toBe("owner");
      expect(UserRole.admin).toBe("admin");
      expect(UserRole.manager).toBe("manager");
      expect(UserRole.field_worker).toBe("field_worker");
      expect(UserRole.viewer).toBe("viewer");
    });

    it("Action has all expected keys", () => {
      expect(Action.view).toBe("view");
      expect(Action.edit).toBe("edit");
      expect(Action.delete).toBe("delete");
      expect(Action.export).toBe("export");
      expect(Action.admin).toBe("admin");
    });
  });
});
