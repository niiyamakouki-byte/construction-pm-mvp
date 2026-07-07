/**
 * freee OAuth ハンドラのテスタブルコア。
 *
 * /api/freee/auth と /api/freee/callback の Vercel Function から呼ばれる。
 * Supabase / fetch を明示的に注入するので、ユニットテストで差し替え可能。
 */

import {
  buildAuthorizeUrl,
  computeExpiresAt,
  exchangeCodeForToken,
  type FreeeTokenResponse,
  type OAuthConfig,
} from "./freee-client.js";

// ── Supabase の最小インターフェース ─────────────────────────

type UpsertResult = { error: { message: string } | null };

export type FreeeTokenUpserter = {
  // ponytail: supabase-js の upsert() は Promise ではなく thenable な
  // PostgrestFilterBuilder を返す（catch/finally/toStringTag を持たない）。
  // PromiseLike にしておけば実体の型が変わっても await 前提のコードは崩れない。
  upsert(row: {
    user_id: string;
    access_token: string;
    refresh_token: string;
    expires_at: string;
    company_id?: number | null;
    scope?: string | null;
  }): PromiseLike<UpsertResult>;
};

// ── Auth (consent リダイレクト) ─────────────────────────────

export type BuildConsentRedirectArgs = {
  clientId: string;
  redirectUri: string;
  state: string;
};

export function buildConsentRedirect(args: BuildConsentRedirectArgs): string {
  return buildAuthorizeUrl(args);
}

// ── Callback (code -> token 交換 + DB 保存) ─────────────────

export type CallbackInput = {
  code: string;
  userId: string;
  config: OAuthConfig;
  store: FreeeTokenUpserter;
  fetchImpl?: typeof fetch;
  now?: Date;
};

export type CallbackResult = {
  expiresAt: string;
  scope?: string;
};

/**
 * OAuth callback の中身:
 *   1. code を freee にポストして token を交換
 *   2. Supabase の freee_tokens に upsert (user_id で一意)
 */
export async function handleOAuthCallback(
  input: CallbackInput,
): Promise<CallbackResult> {
  const token: FreeeTokenResponse = await exchangeCodeForToken(
    input.config,
    input.code,
    input.fetchImpl,
  );

  const expiresAt = computeExpiresAt(token, input.now ?? new Date());

  const { error } = await input.store.upsert({
    user_id: input.userId,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: expiresAt,
    scope: token.scope ?? null,
  });

  if (error) {
    throw new Error(`freee token 保存に失敗しました: ${error.message}`);
  }

  return { expiresAt, scope: token.scope };
}
