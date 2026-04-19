/**
 * invoice-ocr-handler — /api/invoice-ocr のテスタブルなコア。
 *
 * Vercel Serverless Function 本体（api/invoice-ocr.ts）はこれを呼び出すだけ。
 * 認証 / レートリミット / サイズ上限 / Anthropic への委譲を担当する。
 */

import {
  verifyBearerAuth,
  type SupabaseAuthVerifier,
} from "./auth-helper.js";
import { consumeRateLimit, type RateLimitStore } from "./rate-limiter.js";

/** 5MB の base64 上限（リクエストボディサイズ）。 */
export const MAX_BASE64_BYTES = 5 * 1024 * 1024;
export const INVOICE_RATE_LIMIT_PER_MIN = 10;
export const INVOICE_ENDPOINT = "/api/invoice-ocr";

const DEFAULT_MODEL = "claude-opus-4-5";

const EXTRACTION_PROMPT = `あなたは日本の建設会社の経理担当者です。
渡された請求書画像（または PDF の1ページ目）から、以下の JSON を**厳密に**抽出してください。

必ず次の JSON 形式のみで返答してください（解説・前置き禁止）：
{
  "vendor": "業者名（発行元会社名）",
  "invoice_number": "請求書番号",
  "issue_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "items": [
    {"description": "明細の品名", "quantity": 数値, "unit_price": 数値, "amount": 数値}
  ],
  "subtotal": 小計（税抜）,
  "tax": 消費税額,
  "total": 合計（税込）
}

ルール:
- 読み取れない項目は null にしてください（推測で埋めない）
- 金額は円単位の整数、カンマ区切りは除去する
- 日付は和暦表記でも YYYY-MM-DD の西暦に正規化してください
- items が明らかでない場合は空配列 [] で返してください`;

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    }
  | {
      type: "document";
      source: { type: "base64"; media_type: string; data: string };
    };

type AnthropicMessagesResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string; type?: string };
};

export type InvoiceOcrRequestBody = {
  mediaType?: string;
  data?: string;
  fileName?: string;
};

export type InvoiceOcrRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type InvoiceOcrResponse = {
  status: (code: number) => InvoiceOcrResponse;
  json: (body: unknown) => InvoiceOcrResponse;
  setHeader?: (name: string, value: string) => void;
  end?: () => void;
};

export type AnthropicFetcher = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export type InvoiceOcrDeps = {
  /** Supabase auth.getUser ラッパ（本番では getSupabaseServerClient().auth）。 */
  auth: SupabaseAuthVerifier;
  /** レートリミット用ストア。 */
  rateLimitStore: RateLimitStore;
  /** Anthropic Messages API 呼び出し。デフォルトは global fetch。 */
  anthropicFetcher?: AnthropicFetcher;
  /** ANTHROPIC_API_KEY。未設定時は 500 を返す。 */
  anthropicApiKey?: string;
  /** モデル ID。未指定時は claude-opus-4-5。 */
  model?: string;
  /** テスト注入用の現在時刻。 */
  now?: () => Date;
};

function readBody(req: InvoiceOcrRequest): InvoiceOcrRequestBody {
  if (req.body == null) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as InvoiceOcrRequestBody;
    } catch {
      return {};
    }
  }
  return req.body as InvoiceOcrRequestBody;
}

export async function handleInvoiceOcr(
  req: InvoiceOcrRequest,
  res: InvoiceOcrResponse,
  deps: InvoiceOcrDeps,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    res.status(405).json({ error: "POST のみ受け付けます" });
    return;
  }

  // ── 1. 認証 ──────────────────────────────────────────
  const authResult = await verifyBearerAuth(deps.auth, req.headers);
  if (!authResult.ok) {
    res.status(401).json({ error: authResult.error });
    return;
  }

  // ── 2. サイズ上限（認証後に計算してコスト節約）────────
  const { mediaType, data, fileName } = readBody(req);
  if (!mediaType || !data) {
    res.status(400).json({ error: "mediaType と data (base64) が必要です" });
    return;
  }
  if (data.length > MAX_BASE64_BYTES) {
    res.status(413).json({
      error: `ファイルが大きすぎます（上限 ${Math.floor(MAX_BASE64_BYTES / 1024 / 1024)}MB）`,
    });
    return;
  }

  // ── 3. レートリミット ────────────────────────────────
  const decision = await consumeRateLimit(deps.rateLimitStore, {
    userId: authResult.user.id,
    endpoint: INVOICE_ENDPOINT,
    limit: INVOICE_RATE_LIMIT_PER_MIN,
    windowSeconds: 60,
    now: deps.now,
  });
  if (!decision.allowed) {
    res.setHeader?.("Retry-After", String(decision.retryAfterSeconds));
    res.status(429).json({
      error: `リクエストが多すぎます。${decision.retryAfterSeconds}秒後に再試行してください。`,
    });
    return;
  }

  // ── 4. API キー + メディアタイプチェック ─────────────
  const apiKey = deps.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "ANTHROPIC_API_KEY が設定されていません（Vercel の環境変数で設定してください）",
    });
    return;
  }
  const model = deps.model ?? process.env.ANTHROPIC_INVOICE_MODEL ?? DEFAULT_MODEL;

  const isPdf = mediaType === "application/pdf";
  const isImage = mediaType.startsWith("image/");
  if (!isPdf && !isImage) {
    res.status(400).json({ error: "画像 (image/*) か PDF (application/pdf) のみ対応しています" });
    return;
  }

  const fileBlock: AnthropicContentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data } };

  const payload = {
    model,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          fileBlock,
          {
            type: "text",
            text: `${EXTRACTION_PROMPT}\n\nファイル名: ${fileName ?? "（不明）"}`,
          },
        ],
      },
    ],
  };

  const fetcher = deps.anthropicFetcher ?? fetch.bind(globalThis);

  try {
    const anthropicRes = await fetcher("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // PDF サポートに必要なベータヘッダ
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify(payload),
    });

    const json = (await anthropicRes.json()) as AnthropicMessagesResponse;

    if (!anthropicRes.ok) {
      const msg = json?.error?.message ?? `Anthropic API error (${anthropicRes.status})`;
      res.status(502).json({ error: msg });
      return;
    }

    const textBlock = (json.content ?? []).find((b) => b.type === "text");
    const text = textBlock?.text ?? "";
    if (!text) {
      res.status(502).json({ error: "Vision から有効なテキストが返りませんでした" });
      return;
    }

    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "内部エラー" });
  }
}
