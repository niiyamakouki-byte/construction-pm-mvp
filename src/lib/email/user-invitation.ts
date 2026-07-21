/**
 * GenbaHubのユーザー招待メール送信フロー。
 * 招待レコード生成などの上流処理から、確定済みの招待URLを受け取って送信する。
 */

import { sendEmail, type SendEmailResult } from "./resend-client.js";

export type UserInvitation = {
  email: string;
  invitationUrl: string;
  organizationName: string;
  inviterName?: string;
};

export async function sendUserInvitation(
  invitation: UserInvitation,
  deps: { sendEmailImpl?: typeof sendEmail } = {},
): Promise<SendEmailResult> {
  const inviter = invitation.inviterName ? `${invitation.inviterName}さんから` : "";
  const text = [
    `${invitation.organizationName}のLapoSiteへ${inviter}招待されました。`,
    "",
    "以下のリンクから参加してください。",
    invitation.invitationUrl,
    "",
    "この招待に心当たりがない場合は、このメールを破棄してください。",
  ].join("\n");

  return (deps.sendEmailImpl ?? sendEmail)({
    to: invitation.email,
    subject: `[LapoSite] ${invitation.organizationName}への招待`,
    text,
  });
}
