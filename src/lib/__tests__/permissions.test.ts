import { describe, it, expect } from "vitest";
import {
  ALL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  SYSTEM_ROLE_PERMISSIONS,
  getPermissionsByCategory,
  getSystemRolePermissions,
  isValidPermission,
} from "../permissions";

// ─── ALL_PERMISSIONS structure ────────────────────────────────────────────────

describe("ALL_PERMISSIONS", () => {
  it("every permission has a non-empty id, name, description and category", () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(perm.id.length).toBeGreaterThan(0);
      expect(perm.name.length).toBeGreaterThan(0);
      expect(perm.description.length).toBeGreaterThan(0);
      expect(Object.values(PERMISSION_CATEGORIES)).toContain(perm.category);
    }
  });

  it("permission ids are unique", () => {
    const ids = ALL_PERMISSIONS.map(p => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("covers all defined categories", () => {
    const usedCategories = new Set(ALL_PERMISSIONS.map(p => p.category));
    for (const cat of Object.values(PERMISSION_CATEGORIES)) {
      expect(usedCategories.has(cat)).toBe(true);
    }
  });
});

// ─── isValidPermission ────────────────────────────────────────────────────────

describe("isValidPermission", () => {
  it("returns true for a known permission id", () => {
    expect(isValidPermission("create_interviews")).toBe(true);
  });

  it("returns true for every id in ALL_PERMISSIONS", () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(isValidPermission(perm.id)).toBe(true);
    }
  });

  it("returns false for an unknown permission", () => {
    expect(isValidPermission("fly_to_the_moon")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidPermission("")).toBe(false);
  });
});

// ─── getSystemRolePermissions ─────────────────────────────────────────────────

describe("getSystemRolePermissions", () => {
  it("returns empty array for unknown role", () => {
    expect(getSystemRolePermissions("unknown_role")).toEqual([]);
  });

  it("guest has no permissions", () => {
    expect(getSystemRolePermissions("guest")).toEqual([]);
  });

  it("candidate only has view_learning", () => {
    expect(getSystemRolePermissions("candidate")).toEqual(["view_learning"]);
  });

  it("platform_admin has every permission", () => {
    const allIds = ALL_PERMISSIONS.map(p => p.id).sort();
    expect(getSystemRolePermissions("platform_admin").sort()).toEqual(allIds);
  });

  it("platform_admin is a strict superset of partner_admin", () => {
    const admin = new Set(getSystemRolePermissions("platform_admin"));
    for (const perm of getSystemRolePermissions("partner_admin")) {
      expect(admin.has(perm)).toBe(true);
    }
  });

  it("partner_admin is a strict superset of hr_recruiter", () => {
    const partner = new Set(getSystemRolePermissions("partner_admin"));
    for (const perm of getSystemRolePermissions("hr_recruiter")) {
      expect(partner.has(perm)).toBe(true);
    }
  });

  it("billing_contact can only see billing-related permissions", () => {
    const billingPerms = getSystemRolePermissions("billing_contact");
    expect(billingPerms.length).toBeGreaterThan(0);
    for (const id of billingPerms) {
      expect(id).toMatch(/billing|invoice|subscription/);
    }
  });

  it("all returned permission ids are valid", () => {
    for (const role of Object.keys(SYSTEM_ROLE_PERMISSIONS)) {
      for (const id of getSystemRolePermissions(role)) {
        expect(isValidPermission(id)).toBe(true);
      }
    }
  });
});

// ─── getPermissionsByCategory ─────────────────────────────────────────────────

describe("getPermissionsByCategory", () => {
  it("returns an entry for every category", () => {
    const grouped = getPermissionsByCategory();
    for (const cat of Object.values(PERMISSION_CATEGORIES)) {
      expect(grouped[cat]).toBeDefined();
      expect(grouped[cat].length).toBeGreaterThan(0);
    }
  });

  it("total permissions across categories equals ALL_PERMISSIONS length", () => {
    const grouped = getPermissionsByCategory();
    const total = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(ALL_PERMISSIONS.length);
  });

  it("each permission sits only in its declared category", () => {
    const grouped = getPermissionsByCategory();
    for (const [cat, perms] of Object.entries(grouped)) {
      for (const perm of perms) {
        expect(perm.category).toBe(cat);
      }
    }
  });
});
