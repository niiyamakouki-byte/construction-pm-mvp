/**
 * Vercel Serverless Function: POST /api/share-token
 *
 * 施主向け共有リンクの HMAC-SHA256 署名付きトークンを発行・検証する。
 * 署名鍵 (SHARE_TOKEN_SECRET) はサーバー環境変数のみで保持し、クライアントバンドルには出さない
 * （旧実装は VITE_SHARE_TOKEN_SECRET を使っておりブラウザに露出していた。
 *   2026-07-27 セキュリティ監査で発覚、詳細は src/lib/share-token-handler.ts 冒頭コメント参照）。
 *
 * リクエスト body (JSON):
 *   { action: "create", projectId: string, expiresInDays: number, password?: string }
 *     - Authorization: Bearer <supabase-jwt> 必須
 *   { action: "verify", token: string, password?: string }
 *     - 無認証（共有リンクを受け取った施主本人が呼ぶ）
 *
 * 必要な環境変数:
 *   SHARE_TOKEN_SECRET         — HMAC 署名鍵（必須。未設定時は 500）
 *   SUPABASE_URL               — Supabase プロジェクト URL（必須）
 *   SUPABASE_SERVICE_ROLE_KEY  — Supabase Service Role キー（必須。action=create の JWT 検証用）
 */

import { createClient } from "@supabase/supabase-js";
import {
  handleShareTokenRequest,
  type ShareTokenRequest,
  type ShareTokenResponse,
} from "../src/lib/share-token-handler.js";
import { asSupabaseAuthVerifier } from "../src/lib/auth-helper.js";

export default async function handler(
  req: ShareTokenRequest,
  res: ShareTokenResponse,
): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({
      error:
        "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です（Vercel の環境変数を設定してください）",
    });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await handleShareTokenRequest(req, res, {
    auth: asSupabaseAuthVerifier(supabase.auth),
  });
}
