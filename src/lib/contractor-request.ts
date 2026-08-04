/**
 * contractor-request.ts — 工程バーから協力業者へ依頼メールを送信する
 *
 * 既存部品の接続のみ: share-token(createShareToken)でその案件の閲覧専用URLを発行し、
 * resend-client(sendEmail)で依頼メールを送る。新規の永続ストアは増やさない
 * （送信履歴は既存 Notification ドメイン型 / notification-store 経由で記録する。
 * 呼び出し側=GanttPage.tsx が notificationRepository.create() を呼ぶ）。
 *
 * 【重要・外部送信ゲート】mode が "live" でない限り、実際の宛先に関わらず
 * DRY_RUN_RECIPIENT（社内テストアドレス）にのみ送信する。顧客・実在協力業者への
 * 誤送信を防ぐための既定値であり、"live" への切り替えは呼び出し側の feature flag に委ねる。
 */

import { createShareToken, type ShareTokenFetcher } from "./share-token.js";
import { sendEmail } from "./email/resend-client.js";

/** dry-run 時の固定送信先。実送信テストはこのアドレス宛でのみ許可する。 */
export const DRY_RUN_RECIPIENT = "niiyama@laporta.co.jp";

export type ContractorRequestMode = "dry-run" | "live";

export type BuildContractorRequestEmailInput = {
  taskName: string;
  projectName: string;
  startDate: string;
  endDate: string;
  shareUrl: string;
};

/**
 * 依頼メールの件名・本文を組み立てる純粋関数（副作用なし、テスト対象）。
 */
export function buildContractorRequestEmail(
  input: BuildContractorRequestEmailInput,
): { subject: string; text: string } {
  const { taskName, projectName, startDate, endDate, shareUrl } = input;
  const subject = `【${projectName}】${taskName} のご依頼`;
  const text = [
    `${projectName} の工程「${taskName}」についてご依頼します。`,
    "",
    `工程名: ${taskName}`,
    `期間: ${startDate || "未定"} 〜 ${endDate || "未定"}`,
    `現場: ${projectName}`,
    "",
    `詳細確認用リンク: ${shareUrl}`,
  ].join("\n");
  return { subject, text };
}

function buildShareUrl(token: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#/portal/share/${encodeURIComponent(token)}`;
}

export type SendContractorRequestInput = {
  projectId: string;
  projectName: string;
  taskName: string;
  startDate: string;
  endDate: string;
  contractorEmail?: string;
  mode: ContractorRequestMode;
};

export type SendContractorRequestDeps = {
  getAccessToken: () => Promise<string | null>;
  /** テスト注入用。share-token API 呼び出しと resend API 呼び出しの両方に使う。 */
  fetcher?: ShareTokenFetcher;
  /** resend-client のテスト注入用 fetch。省略時は fetcher を流用。 */
  resendFetchImpl?: typeof fetch;
  resendApiKey?: string;
  /** share-token の有効期限（日）。既定14日 */
  expiresInDays?: number;
};

export type SendContractorRequestResult =
  | { ok: true; recipient: string; emailId: string; shareUrl: string }
  | { ok: false; error: string };

/**
 * share-token 発行 → 依頼メール送信までを一気通貫で行う。
 * mode="live" かつ contractorEmail 未設定の場合は送信せずエラーを返す。
 */
export async function sendContractorRequest(
  input: SendContractorRequestInput,
  deps: SendContractorRequestDeps,
): Promise<SendContractorRequestResult> {
  const { projectId, projectName, taskName, startDate, endDate, contractorEmail, mode } = input;

  const recipient = mode === "live" ? contractorEmail : DRY_RUN_RECIPIENT;
  if (!recipient) {
    return { ok: false, error: "協力業者にメールアドレスが未登録のため送信できません" };
  }

  let shareUrl: string;
  try {
    const token = await createShareToken(projectId, {
      expiresInDays: deps.expiresInDays ?? 14,
      getAccessToken: deps.getAccessToken,
      fetcher: deps.fetcher,
    });
    shareUrl = buildShareUrl(token);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "共有URLの発行に失敗しました" };
  }

  const { subject, text } = buildContractorRequestEmail({
    taskName,
    projectName,
    startDate,
    endDate,
    shareUrl,
  });

  try {
    const result = await sendEmail(
      { to: recipient, subject, text },
      { apiKey: deps.resendApiKey, fetchImpl: deps.resendFetchImpl ?? (deps.fetcher as typeof fetch | undefined) },
    );
    return { ok: true, recipient, emailId: result.id, shareUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "メール送信に失敗しました" };
  }
}
