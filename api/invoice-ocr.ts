/**
 * /api/invoice-ocr — 請求書画像/PDFを Claude Vision で抽出するサーバー関数。
 *
 * Vercel Serverless Function として動く。フロントから base64 を受け取り、
 * ANTHROPIC_API_KEY を使ってサーバー側で Claude Messages API を叩く。
 * API キーがブラウザに露出しないことがポイント。
 *
 * 必要な環境変数:
 *   ANTHROPIC_API_KEY         — Anthropic API キー（必須）
 *   ANTHROPIC_INVOICE_MODEL   — モデル ID（任意、デフォルト "claude-opus-4-5"）
 */

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
      source: {
        type: "base64";
        media_type: string;
        data: string;
      };
    }
  | {
      type: "document";
      source: {
        type: "base64";
        media_type: string;
        data: string;
      };
    };

type AnthropicMessagesResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string; type?: string };
};

type RequestBody = {
  mediaType?: string;
  data?: string;
  fileName?: string;
};

type VercelLikeRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelLikeResponse = {
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => VercelLikeResponse;
  setHeader?: (name: string, value: string) => void;
  end?: () => void;
};

function readBody(req: VercelLikeRequest): RequestBody {
  if (req.body == null) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as RequestBody;
    } catch {
      return {};
    }
  }
  return req.body as RequestBody;
}

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST のみ受け付けます" });
    return;
  }

  const { mediaType, data, fileName } = readBody(req);
  if (!mediaType || !data) {
    res.status(400).json({ error: "mediaType と data (base64) が必要です" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "ANTHROPIC_API_KEY が設定されていません（Vercel の環境変数で設定してください）",
    });
    return;
  }
  const model = process.env.ANTHROPIC_INVOICE_MODEL ?? DEFAULT_MODEL;

  const isPdf = mediaType === "application/pdf";
  const isImage = mediaType.startsWith("image/");
  if (!isPdf && !isImage) {
    res.status(400).json({ error: "画像 (image/*) か PDF (application/pdf) のみ対応しています" });
    return;
  }

  const fileBlock: AnthropicContentBlock = isPdf
    ? {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
      }
    : {
        type: "image",
        source: { type: "base64", media_type: mediaType, data },
      };

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

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
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
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "内部エラー" });
  }
}
