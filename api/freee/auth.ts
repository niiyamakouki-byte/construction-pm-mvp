/**
 * Vercel Serverless Function: GET /api/freee/auth
 *
 * 認証済みユーザーを freee の OAuth 同意画面へリダイレクトする。
 *
 * セキュリティ:
 *   - Authorization: Bearer <supabase jwt> が必須（未認証は 401）
 *   - state パラメータに Supabase user id を署名なしで埋める（Phase 1 簡易実装）
 *     → callback 側では必ずその時の JWT から user id を取り直す
 *
 * 必要な環境変数:
 *   VITE_FREEE_CLIENT_ID  — freee developer で発行した Client ID（公開可）
 *   FREEE_REDIRECT_URI    — 例 "https://<project>.vercel.app/api/freee/callback"
 *   SUPABASE_URL          — Supabase プロジェクト URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase Service Role キー（JWT 検証用）
 */

import { createClient } from "@supabase/supabase-js";
import {
  asSupabaseAuthVerifier,
  verifyBearerAuth,
} from "../../src/lib/auth-helper.js";
import { buildConsentRedirect } from "../../src/lib/freee-oauth-handler.js";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  redirect?: (statusOrUrl: number | string, url?: string) => void;
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "GET のみ受け付けます" });
    return;
  }

  const clientId = process.env.VITE_FREEE_CLIENT_ID;
  const redirectUri = process.env.FREEE_REDIRECT_URI;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !redirectUri) {
    res.status(500).json({
      error:
        "VITE_FREEE_CLIENT_ID または FREEE_REDIRECT_URI が未設定です（Vercel 環境変数を設定してください）",
    });
    return;
  }
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({
      error: "SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です",
    });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authResult = await verifyBearerAuth(
    asSupabaseAuthVerifier(supabase.auth),
    req.headers,
  );
  if (!authResult.ok) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  // state には user id を入れる。callback では JWT から取り直すので単なる hint。
  const state = authResult.user.id;
  const url = buildConsentRedirect({ clientId, redirectUri, state });

  res.status(200).json({ url });
}
