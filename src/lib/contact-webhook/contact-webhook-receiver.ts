/**
 * contact-webhook-receiver — laporta-hp /contact フォーム受信
 *
 * POST payload を受け取り、バリデーション + サニタイズして
 * ContactSubmission 型を返す。DOM / LLM 依存なし。
 */

import { sendEmail, type SendEmailResult } from "../email/resend-client.js";

// ── 型定義 ───────────────────────────────────────────────────────────────────

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  message: string;
  source: string;
  timestamp: string;
};

/** POST payload (外部から届く raw JSON) */
export type ContactPayload = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: unknown;
  message?: unknown;
  source?: unknown;
  timestamp?: unknown;
};

export type ValidationError = {
  field: string;
  message: string;
};

export type ReceiverResult =
  | { ok: true; submission: ContactSubmission }
  | { ok: false; errors: ValidationError[] };

export type ContactNotificationResult = {
  submission: ContactSubmission;
  email: SendEmailResult;
};

const OPERATIONS_EMAIL = "niiyama@laporta.co.jp";

// ── バリデーション ────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  // HTML タグ除去 + 前後空白トリム
  return value.replace(/<[^>]*>/g, "").trim();
}

function validateEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

// ── メイン関数 ───────────────────────────────────────────────────────────────

/**
 * laporta-hp から受信した問い合わせ payload をバリデーション・サニタイズする。
 */
export function receiveContactSubmission(payload: ContactPayload): ReceiverResult {
  const errors: ValidationError[] = [];

  const name = sanitizeString(payload.name);
  const email = sanitizeString(payload.email);
  const phone = sanitizeString(payload.phone);
  const address = sanitizeString(payload.address);
  const message = sanitizeString(payload.message);
  const source = sanitizeString(payload.source) || "laporta-hp";
  const rawTimestamp = sanitizeString(payload.timestamp);
  const timestamp =
    rawTimestamp && !isNaN(Date.parse(rawTimestamp))
      ? rawTimestamp
      : new Date().toISOString();

  if (!name) {
    errors.push({ field: "name", message: "お名前は必須です" });
  } else if (name.length > 100) {
    errors.push({ field: "name", message: "お名前は100文字以内です" });
  }

  if (!email) {
    errors.push({ field: "email", message: "メールアドレスは必須です" });
  } else if (!validateEmail(email)) {
    errors.push({ field: "email", message: "メールアドレスの形式が正しくありません" });
  }

  if (!message) {
    errors.push({ field: "message", message: "お問い合わせ内容は必須です" });
  } else if (message.length > 5000) {
    errors.push({ field: "message", message: "お問い合わせ内容は5,000文字以内です" });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const submission: ContactSubmission = {
    id: `inquiry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    email,
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {}),
    message,
    source,
    timestamp,
  };

  return { ok: true, submission };
}

/**
 * 問い合わせを受信し、正常な場合だけ運営へ通知メールを送る。
 */
export async function receiveContactSubmissionAndNotify(
  payload: ContactPayload,
  deps: { sendEmailImpl?: typeof sendEmail } = {},
): Promise<ReceiverResult | { ok: true; notification: ContactNotificationResult }> {
  const received = receiveContactSubmission(payload);
  if (!received.ok) return received;

  const { submission } = received;
  const text = [
    "LapoSiteに新しい問い合わせが届きました。",
    "",
    `お名前: ${submission.name}`,
    `メール: ${submission.email}`,
    `電話: ${submission.phone ?? "未入力"}`,
    `住所: ${submission.address ?? "未入力"}`,
    `送信元: ${submission.source}`,
    `受信日時: ${submission.timestamp}`,
    "",
    "お問い合わせ内容:",
    submission.message,
  ].join("\n");

  const email = await (deps.sendEmailImpl ?? sendEmail)({
    to: OPERATIONS_EMAIL,
    subject: `[LapoSite] 新しい問い合わせ: ${submission.name}`,
    text,
    replyTo: submission.email,
  });

  return { ok: true, notification: { submission, email } };
}
