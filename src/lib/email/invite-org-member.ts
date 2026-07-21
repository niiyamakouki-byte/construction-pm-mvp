/**
 * invite-org-member — 組織オーナー/管理者によるメンバーメール招待のコアロジック。
 *
 * Vercel Serverless Function（api/notify.ts, type: "invite"）から呼び出される
 * テスタブルなコア。招待リンクの発行元（Supabase Admin API 等）と
 * メール送信（sendUserInvitation）は依存性注入可能にしておき、
 * ユニットテストではモックを渡せるようにする（checkout-session.ts と同じ方針）。
 *
 * 招待管理用の新規テーブルは追加しない。既存の organization_members から
 * 依頼者の権限（owner/admin）を確認し、招待リンクの発行は Supabase Auth の
 * 既存の招待プリミティブ（auth.admin.generateLink）に委譲する。
 */

import { sendUserInvitation } from "./user-invitation.js";

export type OrgMembership = {
  organizationId: string;
  organizationName: string;
  role: "owner" | "admin" | "member";
};

export type InviteLinkResult =
  | { ok: true; invitationUrl: string }
  | { ok: false; error: string };

export type InviteOrgMemberInput = {
  email: string;
  inviterName?: string;
};

export type InviteOrgMemberDeps = {
  /** 依頼者（認証済みユーザー）の組織所属・ロールを引く */
  lookupRequesterMembership: (requesterId: string) => Promise<OrgMembership | null>;
  /** 招待リンクを発行する（実装は Supabase Admin API を想定） */
  generateInviteLink: (email: string) => Promise<InviteLinkResult>;
  sendUserInvitationImpl?: typeof sendUserInvitation;
};

export type InviteOrgMemberResult =
  | { ok: true; emailId: string; organizationName: string }
  | { ok: false; status: 400 | 403 | 502; error: string };

export async function inviteOrgMember(
  requesterId: string,
  input: InviteOrgMemberInput,
  deps: InviteOrgMemberDeps,
): Promise<InviteOrgMemberResult> {
  if (!input.email || !input.email.includes("@")) {
    return { ok: false, status: 400, error: "招待先メールアドレスが不正です" };
  }

  const membership = await deps.lookupRequesterMembership(requesterId);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { ok: false, status: 403, error: "招待権限がありません（owner/adminのみ）" };
  }

  const link = await deps.generateInviteLink(input.email);
  if (!link.ok) {
    return { ok: false, status: 502, error: link.error };
  }

  const email = await (deps.sendUserInvitationImpl ?? sendUserInvitation)({
    email: input.email,
    invitationUrl: link.invitationUrl,
    organizationName: membership.organizationName,
    inviterName: input.inviterName,
  });

  return { ok: true, emailId: email.id, organizationName: membership.organizationName };
}
