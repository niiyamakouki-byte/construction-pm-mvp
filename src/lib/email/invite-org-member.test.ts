import { describe, expect, it, vi } from "vitest";
import { inviteOrgMember, type InviteOrgMemberDeps } from "./invite-org-member.js";

function makeDeps(overrides: Partial<InviteOrgMemberDeps> = {}): InviteOrgMemberDeps {
  return {
    lookupRequesterMembership: vi.fn().mockResolvedValue({
      organizationId: "org-1",
      organizationName: "株式会社ラポルタ",
      role: "owner",
    }),
    generateInviteLink: vi.fn().mockResolvedValue({
      ok: true,
      invitationUrl: "https://genbahub.vercel.app/#/invitations/token-abc",
    }),
    sendUserInvitationImpl: vi.fn().mockResolvedValue({ id: "email-invite-1" }),
    ...overrides,
  };
}

describe("inviteOrgMember", () => {
  it("owner が招待すると招待リンク付きメールを送信する", async () => {
    const deps = makeDeps();

    const result = await inviteOrgMember(
      "user-1",
      { email: "member@example.com", inviterName: "新山" },
      deps,
    );

    expect(result).toEqual({
      ok: true,
      emailId: "email-invite-1",
      organizationName: "株式会社ラポルタ",
    });
    expect(deps.sendUserInvitationImpl).toHaveBeenCalledWith({
      email: "member@example.com",
      invitationUrl: "https://genbahub.vercel.app/#/invitations/token-abc",
      organizationName: "株式会社ラポルタ",
      inviterName: "新山",
    });
  });

  it("admin ロールでも招待できる", async () => {
    const deps = makeDeps({
      lookupRequesterMembership: vi.fn().mockResolvedValue({
        organizationId: "org-1",
        organizationName: "株式会社ラポルタ",
        role: "admin",
      }),
    });

    const result = await inviteOrgMember("user-2", { email: "member@example.com" }, deps);
    expect(result.ok).toBe(true);
  });

  it("member ロールは招待できない（403）", async () => {
    const deps = makeDeps({
      lookupRequesterMembership: vi.fn().mockResolvedValue({
        organizationId: "org-1",
        organizationName: "株式会社ラポルタ",
        role: "member",
      }),
    });

    const result = await inviteOrgMember("user-3", { email: "member@example.com" }, deps);
    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "招待権限がありません（owner/adminのみ）",
    });
    expect(deps.sendUserInvitationImpl).not.toHaveBeenCalled();
  });

  it("組織に所属していない場合は403", async () => {
    const deps = makeDeps({ lookupRequesterMembership: vi.fn().mockResolvedValue(null) });

    const result = await inviteOrgMember("user-4", { email: "member@example.com" }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("不正なメールアドレスは400", async () => {
    const deps = makeDeps();
    const result = await inviteOrgMember("user-1", { email: "not-an-email" }, deps);
    expect(result).toEqual({ ok: false, status: 400, error: "招待先メールアドレスが不正です" });
    expect(deps.lookupRequesterMembership).not.toHaveBeenCalled();
  });

  it("招待リンク発行に失敗したら502", async () => {
    const deps = makeDeps({
      generateInviteLink: vi.fn().mockResolvedValue({ ok: false, error: "既に登録済みのメールです" }),
    });

    const result = await inviteOrgMember("user-1", { email: "member@example.com" }, deps);
    expect(result).toEqual({ ok: false, status: 502, error: "既に登録済みのメールです" });
    expect(deps.sendUserInvitationImpl).not.toHaveBeenCalled();
  });
});
