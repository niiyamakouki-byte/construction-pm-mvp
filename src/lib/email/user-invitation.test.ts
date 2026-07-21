import { describe, expect, it, vi } from "vitest";
import { sendUserInvitation } from "./user-invitation.js";

describe("sendUserInvitation", () => {
  it("招待先と参加URLを含むメールを送信する", async () => {
    const sendEmailImpl = vi.fn().mockResolvedValue({ id: "email-invite-1" });

    const result = await sendUserInvitation(
      {
        email: "niiyama@laporta.co.jp",
        invitationUrl: "https://example.com/invitations/token-123",
        organizationName: "株式会社ラポルタ",
        inviterName: "新山",
      },
      { sendEmailImpl },
    );

    expect(sendEmailImpl).toHaveBeenCalledWith({
      to: "niiyama@laporta.co.jp",
      subject: "[GenbaHub] 株式会社ラポルタへの招待",
      text: expect.stringContaining("https://example.com/invitations/token-123"),
    });
    expect(result).toEqual({ id: "email-invite-1" });
  });
});
