/**
 * Resend (https://resend.com) を使ったメール送信のコア実装。
 *
 * fetch は依存性注入可能にしておき、ユニットテストではモックを渡せるようにする
 * （src/lib/checkout-session.ts の Stripe SDK 注入パターンに合わせる）。
 *
 * 無料枠（月3,000通）での運用を前提とし、SDK 依存は追加せず Resend の
 * HTTP API (`POST https://api.resend.com/emails`) を直接呼び出す。
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

export type SendEmailResult = {
  id: string;
};

export type SendEmailError = {
  status: number;
  message: string;
};

export class ResendConfigError extends Error {}
export class ResendApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const DEFAULT_FROM = "LapoSite <onboarding@resend.dev>";

export async function sendEmail(
  input: SendEmailInput,
  deps: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<SendEmailResult> {
  const apiKey = deps.apiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new ResendConfigError("RESEND_API_KEY が未設定です");
  }
  if (!input.html && !input.text) {
    throw new ResendConfigError("html または text のいずれかが必須です");
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const res = await fetchImpl(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from ?? DEFAULT_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const message = typeof body.message === "string" ? body.message : `Resend API error (HTTP ${res.status})`;
    throw new ResendApiError(res.status, message);
  }

  return { id: String(body.id ?? "") };
}
