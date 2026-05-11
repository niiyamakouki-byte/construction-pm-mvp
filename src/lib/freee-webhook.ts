/**
 * freee 会計 Webhook 受信ロジック（テスト可能なコア部分）。
 *
 * 検証は freee 公式仕様に従い、ヘッダー `x-freee-token` の固定文字列等価比較。
 * (developer.freee.co.jp/reference/accounting/webhook より 2026-05-11 確認)
 */
import { timingSafeEqual } from "node:crypto";

export type FreeePayload = {
  id?: string | number;
  application_id?: string | number;
  resource?: string;
  action?: string;
  created_at?: string;
  [key: string]: unknown;
};

export function tokensMatch(received: string, expected: string): boolean {
  if (!received || !expected) return false;
  if (received.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function formatDiscordContent(payload: FreeePayload): string {
  const resource = payload.resource ?? "unknown";
  const action = payload.action ?? "unknown";
  const at = payload.created_at ?? new Date().toISOString();

  const lines: string[] = [
    `**freee 通知** — \`${resource}\` / \`${action}\``,
    `🕐 ${at}`,
  ];

  const wt = (payload as { wallet_txn?: Record<string, unknown> }).wallet_txn;
  if (wt && typeof wt === "object") {
    const amount = typeof wt.amount === "number" ? wt.amount : null;
    const date = typeof wt.date === "string" ? wt.date : null;
    const desc = typeof wt.description === "string" ? wt.description : null;
    if (amount !== null) {
      const yen = amount.toLocaleString("ja-JP");
      const sign = amount >= 0 ? "🟢 入金" : "🔴 出金";
      lines.push(`${sign}: ¥${yen}`);
    }
    if (date) lines.push(`📅 取引日: ${date}`);
    if (desc) lines.push(`📝 ${desc}`);
  }

  const deal = (payload as { deal?: Record<string, unknown> }).deal;
  if (deal && typeof deal === "object") {
    const amount = typeof deal.amount === "number" ? deal.amount : null;
    const issueDate = typeof deal.issue_date === "string" ? deal.issue_date : null;
    const type = typeof deal.type === "string" ? deal.type : null;
    if (amount !== null) {
      lines.push(`💴 ¥${amount.toLocaleString("ja-JP")}${type ? ` (${type})` : ""}`);
    }
    if (issueDate) lines.push(`📅 発生日: ${issueDate}`);
  }

  return lines.join("\n");
}

export async function postToDiscord(
  url: string,
  content: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[freee-webhook] Discord post failed: ${res.status} ${text}`);
  }
}
