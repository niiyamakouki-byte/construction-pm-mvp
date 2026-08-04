import { describe, expect, it, vi } from "vitest";
import { inviteTeamMember } from "./invite-team-member.js";

describe("inviteTeamMember", () => {
  it("成功時はエラーを投げない。Authorizationヘッダーとemailを正しく送る", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, emailId: "email-1", organizationName: "株式会社ラポルタ" }),
    });

    await inviteTeamMember("member@example.com", "token-abc", {
      inviterName: "新山",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/push/invite",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
        body: JSON.stringify({ email: "member@example.com", inviterName: "新山" }),
      }),
    );
  });

  it("サーバーがエラーを返したら例外を投げる", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, error: "招待権限がありません（owner/adminのみ）" }),
    });

    await expect(inviteTeamMember("member@example.com", "token-abc", { fetcher })).rejects.toThrow(
      "招待権限がありません（owner/adminのみ）",
    );
  });
});
