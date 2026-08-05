/**
 * 招待リンク経由サインアップ判定のテスト（票 construction_pm_mvp-1g7 AC③）
 * 設計: docs/onboarding-flow.md
 */
import { describe, expect, it } from "vitest";
import { resolveInvitedMembership, resolveOrganizationRole } from "./OrganizationContext.js";

describe("resolveInvitedMembership", () => {
  it("user_metadataが無ければnull（通常の自己組織作成フロー）", () => {
    expect(resolveInvitedMembership(undefined)).toBeNull();
    expect(resolveInvitedMembership({})).toBeNull();
  });

  it("invited_organization_idがあれば参加先を返す（role未指定はmember）", () => {
    const result = resolveInvitedMembership({ invited_organization_id: "org-1" });
    expect(result).toEqual({ organizationId: "org-1", role: "member" });
  });

  it("invited_roleが指定されていればそれを使う", () => {
    const result = resolveInvitedMembership({
      invited_organization_id: "org-1",
      invited_role: "admin",
    });
    expect(result).toEqual({ organizationId: "org-1", role: "admin" });
  });

  it("invited_organization_idが文字列でなければnull", () => {
    expect(resolveInvitedMembership({ invited_organization_id: 123 })).toBeNull();
    expect(resolveInvitedMembership({ invited_organization_id: "" })).toBeNull();
  });
});

describe("resolveOrganizationRole", () => {
  it("RBACの5ロールをそのまま返す", () => {
    expect(resolveOrganizationRole("owner")).toBe("owner");
    expect(resolveOrganizationRole("admin")).toBe("admin");
    expect(resolveOrganizationRole("manager")).toBe("manager");
    expect(resolveOrganizationRole("field_worker")).toBe("field_worker");
    expect(resolveOrganizationRole("viewer")).toBe("viewer");
  });

  it("既存のmemberはfield_worker、未知ロールはviewerへ安全側に倒す", () => {
    expect(resolveOrganizationRole("member")).toBe("field_worker");
    expect(resolveOrganizationRole("unknown")).toBe("viewer");
  });
});
