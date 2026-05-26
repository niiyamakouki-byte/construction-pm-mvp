/**
 * freee-api-client — FreeeJournalDraft を freee API に送信する薄いラッパー。
 *
 * env 未設定時は dryRun モードで ok:true を返す。
 * 既存の src/lib/freee/client.ts (FreeeClient) は取引の CRUD を担うが、
 * 本ファイルはレシート仕訳ドラフトの単発 POST に特化した薄いラッパーとして追加する。
 */

import type { FreeeJournalDraft } from "./freee-journal-mapper.js";

// ── 型 ────────────────────────────────────────────────

export type FreeeEnv = {
  client_id?: string;
  client_secret?: string;
  access_token?: string;
  /** freee 事業所 ID。未指定時は 1 を仮定 */
  company_id?: number;
};

export type SubmitResult = {
  ok: boolean;
  mode: "live" | "dry_run";
  deal_id?: number;
  error?: string;
};

const FREEE_API_BASE = "https://api.freee.co.jp";

// ── freee API ペイロード構築 ───────────────────────────

/**
 * FreeeJournalDraft → POST /api/1/deals 用ペイロードに変換する。
 * freee の取引 API は details 配列が必須なため最低1行作る。
 */
function buildDealPayload(
  draft: FreeeJournalDraft,
  companyId: number,
): Record<string, unknown> {
  return {
    company_id: companyId,
    issue_date: draft.issue_date,
    due_date: draft.issue_date,
    type: "expense",
    details: [
      {
        account_item_id: null, // freee API は account_item_name でも受け付ける
        account_item_name: draft.account_item,
        tax_code: draft.tax_code,
        amount: draft.amount,
        description: draft.description,
      },
    ],
    partner_name: draft.partner_name,
  };
}

// ── エラーメッセージ日本語化 ──────────────────────────

function toJapaneseError(status: number, body: string): string {
  if (status === 401)
    return "freee 認証エラー: アクセストークンが無効です。再ログインしてください。";
  if (status === 403)
    return "freee 権限エラー: この操作を実行する権限がありません。";
  if (status === 422)
    return `freee バリデーションエラー: 入力内容を確認してください。(${body.slice(0, 120)})`;
  return `freee API エラー (${status}): ${body.slice(0, 120)}`;
}

// ── メインエントリ ────────────────────────────────────

/**
 * FreeeJournalDraft を freee 取引 API に送信する。
 *
 * env.access_token が未設定の場合は dryRun モードで console.warn を出し ok:true を返す。
 * テストでは fetchImpl を差し替えてモックできる。
 *
 * @param draft - mapToJournal() が返したドラフト
 * @param env - freee 認証情報。未設定フィールドは undefined でよい
 * @param fetchImpl - テスト差し替え用。省略時は globalThis.fetch
 */
export async function submitJournal(
  draft: FreeeJournalDraft,
  env: FreeeEnv,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<SubmitResult> {
  // ── dry-run ───────────────────────────────────────
  if (!env.access_token) {
    console.warn(
      "[freee-api-client] freee env 未設定（access_token なし）。dry-run で記録します。",
      { draft },
    );
    return { ok: true, mode: "dry_run" };
  }

  // ── live ──────────────────────────────────────────
  const companyId = env.company_id ?? 1;
  const payload = buildDealPayload(draft, companyId);

  let response: Response;
  try {
    response = await fetchImpl(`${FREEE_API_BASE}/api/1/deals`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.access_token}`,
        "Content-Type": "application/json",
        "X-Api-Version": "2020-06-15",
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    return {
      ok: false,
      mode: "live",
      error: `ネットワークエラー: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`,
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      mode: "live",
      error: toJapaneseError(response.status, body),
    };
  }

  let data: { deal?: { id?: number } };
  try {
    data = (await response.json()) as { deal?: { id?: number } };
  } catch {
    return { ok: false, mode: "live", error: "freee レスポンスの解析に失敗しました。" };
  }

  return {
    ok: true,
    mode: "live",
    deal_id: data.deal?.id,
  };
}
