/**
 * invite-team-member.ts — /account「チームメンバー」セクションから
 * POST /api/push/invite を叩くクライアント側の薄いラッパー
 * （票 construction_pm_mvp-1g7 AC③、設計: docs/onboarding-flow.md）。
 *
 * サーバー側の実装（招待権限チェック・招待リンク発行・メール送信）は
 * src/lib/email/invite-org-member.ts / src/vercel-handlers/notify/invite.ts に既にある。
 * ここは src/lib/share-token.ts の createShareToken と同じ DI パターンで
 * fetch を呼ぶだけの薄い層にする。
 */

export type InviteTeamMemberFetcher = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

/**
 * チームメンバーをメールアドレスで招待する。
 *
 * @throws サーバーがエラーを返した場合（権限なし・メールアドレス不正・送信失敗等）
 */
export async function inviteTeamMember(
  email: string,
  accessToken: string,
  opts?: { inviterName?: string; fetcher?: InviteTeamMemberFetcher },
): Promise<void> {
  const doFetch = opts?.fetcher ?? (fetch.bind(globalThis) as InviteTeamMemberFetcher);

  const res = await doFetch("/api/push/invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ email, inviterName: opts?.inviterName }),
  });

  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? `招待の送信に失敗しました (HTTP ${res.status})`);
  }
}
