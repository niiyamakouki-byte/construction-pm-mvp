/**
 * Vercel Serverless Function: GET /api/freee/callback
 *
 * freee OAuth の consent 画面からリダイレクトされてくる。
 *   ?code=<auth code>&state=<supabase user id>
 *
 * 1. Authorization ヘッダで Supabase JWT を検証（state だけでは信用しない）
 * 2. code を freee の /public_api/token に交換
 * 3. freee_tokens テーブルに upsert
 * 4. /#/freee?connected=1 にリダイレクト
 *
 * 必要な環境変数:
 *   VITE_FREEE_CLIENT_ID, FREEE_CLIENT_SECRET, FREEE_REDIRECT_URI
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import {
  asSupabaseAuthVerifier,
  verifyBearerAuth,
} from "../../src/lib/auth-helper.js";
import { handleOAuthCallback } from "../../src/lib/freee-oauth-handler.js";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (body && typeof body === "object") return body as Record<string, unknown>;
  return {};
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // ブラウザからの GET（freee からのリダイレクト）と、SPA が code を渡しに来る POST の両対応。
  // Phase 1 では SPA 側が window.location で code を受け取り、POST で再送する形に統一。
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "POST のみ受け付けます" });
    return;
  }

  const clientId = process.env.VITE_FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  const redirectUri = process.env.FREEE_REDIRECT_URI;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !clientSecret || !redirectUri) {
    res.status(500).json({
      error:
        "freee OAuth の環境変数が未設定です（VITE_FREEE_CLIENT_ID / FREEE_CLIENT_SECRET / FREEE_REDIRECT_URI）",
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

  const body = parseBody(req.body);
  const code = typeof body.code === "string" ? body.code : "";
  if (!code) {
    res.status(400).json({ error: "code パラメータが必要です" });
    return;
  }

  try {
    const result = await handleOAuthCallback({
      code,
      userId: authResult.user.id,
      config: { clientId, clientSecret, redirectUri },
      store: supabase.from("freee_tokens"),
    });
    res.status(200).json({
      ok: true,
      expires_at: result.expiresAt,
      scope: result.scope ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error("[freee/callback] failed:", err);
    res.status(500).json({ error: `freee連携に失敗しました: ${message}` });
  }
}
