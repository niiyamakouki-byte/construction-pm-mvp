/**
 * invoice-vision — 請求書画像を Claude Vision API 経由で構造化抽出する。
 *
 * ブラウザから直接 Anthropic API を叩くと API キーが露出するので、
 * Vercel Serverless Function (/api/invoice-ocr) を経由する。
 *
 * サーバー側で ANTHROPIC_API_KEY を読み、Claude にビジョンリクエストを投げて
 * JSON（InvoiceExtraction 形式）を返す。
 *
 * /api/invoice-ocr は認証必須なので、Supabase のアクセストークンを
 * Authorization: Bearer ヘッダで送る。401/429/413 は専用のエラー型を投げる。
 */

import {
  InvoiceExtractionSchema,
  type InvoiceExtraction,
} from "../domain/invoice-extraction-schema.js";
import { parseOrThrow } from "../domain/schemas.js";

export type VisionFetcher = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export type TokenProvider = () => Promise<string | null>;

export type ExtractInvoiceOptions = {
  endpoint?: string;
  fetcher?: VisionFetcher;
  /** Supabase アクセストークンを返す関数。null なら Authorization ヘッダを付けない。 */
  getAccessToken?: TokenProvider;
};

/** /api/invoice-ocr が HTTP エラーを返したときに投げるエラー型。 */
export class InvoiceOcrError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;
  constructor(
    message: string,
    options: { status: number; retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = "InvoiceOcrError";
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/**
 * File を data URL (base64) に変換する。
 * 画像 (image/*) と PDF (application/pdf) の両方に対応。
 */
export async function fileToBase64DataUrl(file: File): Promise<{
  mediaType: string;
  base64: string;
}> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 =
    typeof btoa !== "undefined"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");
  return { mediaType: file.type || "application/octet-stream", base64 };
}

/**
 * Claude が返したテキストブロックから JSON を取り出してパースする。
 * ```json ... ``` フェンスで囲まれている場合も先頭・末尾の { ... } を拾う。
 */
export function parseVisionResponseText(text: string): InvoiceExtraction {
  if (!text || !text.trim()) {
    throw new Error("Vision レスポンスが空です");
  }

  // ```json ... ``` フェンスを剥がす
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : text;

  // 最初の { から最後の } までを抜き出す（前後の説明文を捨てる）
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("Vision レスポンスに JSON が見つかりません");
  }
  const jsonSlice = candidate.slice(firstBrace, lastBrace + 1);

  let raw: unknown;
  try {
    raw = JSON.parse(jsonSlice);
  } catch (e) {
    throw new Error(
      `Vision レスポンスの JSON パースに失敗しました: ${
        e instanceof Error ? e.message : String(e)
      }`,
      e instanceof Error ? { cause: e } : undefined,
    );
  }

  return parseOrThrow(InvoiceExtractionSchema, "InvoiceExtraction", raw);
}

/**
 * /api/invoice-ocr に POST して請求書を抽出する。
 *
 * 失敗時は Error を投げる（UI 側で friendly メッセージに変換する想定）。
 * 401/429/413 は InvoiceOcrError（status 付き）を投げる。
 */
export async function extractInvoiceFromFile(
  file: File,
  options: ExtractInvoiceOptions = {},
): Promise<InvoiceExtraction> {
  const endpoint = options.endpoint ?? "/api/invoice-ocr";
  const fetcher = options.fetcher ?? fetch.bind(globalThis);

  const { mediaType, base64 } = await fileToBase64DataUrl(file);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.getAccessToken) {
    const token = await options.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetcher(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      mediaType,
      data: base64,
      fileName: file.name,
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: string };
      detail = body?.error ?? "";
    } catch {
      // ignore
    }
    const retryHeader = response.headers.get?.("Retry-After");
    const retryAfterSeconds = retryHeader ? Number(retryHeader) : undefined;
    throw new InvoiceOcrError(
      detail
        ? `請求書OCRに失敗しました: ${detail}`
        : `請求書OCRに失敗しました (HTTP ${response.status})`,
      {
        status: response.status,
        retryAfterSeconds: Number.isFinite(retryAfterSeconds)
          ? retryAfterSeconds
          : undefined,
      },
    );
  }

  const payload = (await response.json()) as { text?: string };

  if (typeof payload.text !== "string") {
    throw new Error("Vision レスポンスの形式が不正です");
  }

  return parseVisionResponseText(payload.text);
}
