/**
 * /api/invoice-ocr — 請求書画像/PDFを Claude Vision で抽出するサーバー関数。
 *
 * Vercel Serverless Function として動く。フロントから base64 を受け取り、
 * ANTHROPIC_API_KEY を使ってサーバー側で Claude Messages API を叩く。
 * API キーがブラウザに露出しないことがポイント。
 *
 * セキュリティ:
 *   - Authorization: Bearer <supabase-jwt> を必須（401 で拒否）
 *   - ユーザー単位で 10 req/min のレートリミット（429 + Retry-After）
 *   - リクエスト body の base64 は 5MB 上限（413）
 *
 * 必要な環境変数:
 *   ANTHROPIC_API_KEY         — Anthropic API キー（必須）
 *   ANTHROPIC_INVOICE_MODEL   — モデル ID（任意、デフォルト "claude-opus-4-5"）
 *   SUPABASE_URL              — Supabase プロジェクト URL（必須）
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase Service Role キー（必須。JWT 検証 + RPC 用）
 */

import { createClient } from "@supabase/supabase-js";
import {
  handleInvoiceOcr,
  type InvoiceOcrRequest,
  type InvoiceOcrResponse,
} from "../src/lib/invoice-ocr-handler.js";
import { createSupabaseRateLimitStore } from "../src/lib/rate-limiter.js";

export default async function handler(
  req: InvoiceOcrRequest,
  res: InvoiceOcrResponse,
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

  await handleInvoiceOcr(req, res, {
    auth: supabase.auth,
    rateLimitStore: createSupabaseRateLimitStore(supabase),
  });
}
