import { describe, expect, it, vi } from "vitest";
import {
  extractInvoiceFromFile,
  parseVisionResponseText,
} from "./invoice-vision.js";
import { InvoiceExtractionSchema } from "../domain/invoice-extraction-schema.js";

// ── Zod スキーマ検証 ──────────────────────────────────────

describe("InvoiceExtractionSchema", () => {
  it("完全な有効レスポンスをパースする", () => {
    const result = InvoiceExtractionSchema.parse({
      vendor: "田中工務店",
      invoice_number: "INV-001",
      issue_date: "2026-04-10",
      due_date: "2026-05-10",
      items: [
        { description: "内装工事", quantity: 1, unit_price: 500000, amount: 500000 },
      ],
      subtotal: 500000,
      tax: 50000,
      total: 550000,
    });
    expect(result.vendor).toBe("田中工務店");
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(550000);
  });

  it("null やフィールド欠損を寛容に扱う", () => {
    const result = InvoiceExtractionSchema.parse({
      vendor: null,
      invoice_number: null,
      issue_date: null,
      due_date: "",
      subtotal: null,
      tax: null,
      total: 100000,
    });
    expect(result.vendor).toBe("");
    expect(result.invoice_number).toBe("");
    expect(result.issue_date).toBeUndefined();
    expect(result.due_date).toBeUndefined();
    expect(result.items).toEqual([]);
    expect(result.total).toBe(100000);
  });

  it("無効な日付フォーマットを拒否する", () => {
    const r = InvoiceExtractionSchema.safeParse({
      vendor: "A",
      issue_date: "2026/04/10",
    });
    expect(r.success).toBe(false);
  });

  it("負の金額を拒否する", () => {
    const r = InvoiceExtractionSchema.safeParse({
      vendor: "A",
      total: -100,
    });
    expect(r.success).toBe(false);
  });
});

// ── Vision テキストパーサ ───────────────────────────────────

describe("parseVisionResponseText", () => {
  it("素の JSON を抽出する", () => {
    const text = `{"vendor": "山田建設", "total": 330000}`;
    const result = parseVisionResponseText(text);
    expect(result.vendor).toBe("山田建設");
    expect(result.total).toBe(330000);
  });

  it("```json フェンスを剥がす", () => {
    const text =
      "以下が抽出結果です:\n```json\n" +
      `{"vendor": "佐藤塗装", "issue_date": "2026-04-01", "total": 180000}` +
      "\n```\n ご確認ください。";
    const result = parseVisionResponseText(text);
    expect(result.vendor).toBe("佐藤塗装");
    expect(result.issue_date).toBe("2026-04-01");
  });

  it("JSON 前後の説明文を無視する", () => {
    const text = `了解しました。 {"vendor": "鈴木電気", "total": 98000} です。`;
    const result = parseVisionResponseText(text);
    expect(result.vendor).toBe("鈴木電気");
  });

  it("空文字列は Error を投げる", () => {
    expect(() => parseVisionResponseText("")).toThrow(/空/);
    expect(() => parseVisionResponseText("   ")).toThrow(/空/);
  });

  it("JSON を含まないテキストは Error を投げる", () => {
    expect(() => parseVisionResponseText("JSON はありません")).toThrow(/JSON/);
  });

  it("壊れた JSON は Error を投げる", () => {
    expect(() => parseVisionResponseText(`{ "vendor": broken }`)).toThrow(/パース/);
  });

  it("スキーマ違反 (負の金額) は Error を投げる", () => {
    expect(() =>
      parseVisionResponseText(`{ "vendor": "x", "total": -100 }`),
    ).toThrow();
  });
});

// ── extractInvoiceFromFile (Anthropic SDK モック) ───────────

function makeFile(name: string, type: string, bytes = new Uint8Array([1, 2, 3, 4])): File {
  const file = new File([bytes], name, { type });
  // jsdom の File には arrayBuffer 実装が無いので補う
  if (typeof (file as unknown as { arrayBuffer?: unknown }).arrayBuffer !== "function") {
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    });
  }
  return file;
}

describe("extractInvoiceFromFile", () => {
  it("/api/invoice-ocr に POST し、text を Zod で検証して返す", async () => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      new Response(
        JSON.stringify({
          text: `{"vendor": "東京内装", "issue_date": "2026-04-15", "total": 275000}`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const file = makeFile("invoice.png", "image/png");
    const result = await extractInvoiceFromFile(file, { fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/invoice-ocr");
    expect(init?.method).toBe("POST");
    const body = JSON.parse((init?.body as string) ?? "{}");
    expect(body.mediaType).toBe("image/png");
    expect(typeof body.data).toBe("string");
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.fileName).toBe("invoice.png");

    expect(result.vendor).toBe("東京内装");
    expect(result.total).toBe(275000);
  });

  it("extraction オブジェクトを直接返すパスも機能する", async () => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      new Response(
        JSON.stringify({
          extraction: { vendor: "直接返し", total: 42000 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const file = makeFile("x.png", "image/png");
    const result = await extractInvoiceFromFile(file, { fetcher });
    expect(result.vendor).toBe("直接返し");
    expect(result.total).toBe(42000);
  });

  it("非 2xx レスポンスは日本語エラーを投げる", async () => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      new Response(JSON.stringify({ error: "キーがありません" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const file = makeFile("x.png", "image/png");
    await expect(extractInvoiceFromFile(file, { fetcher })).rejects.toThrow(
      /請求書OCRに失敗/,
    );
  });

  it("PDF も送信できる", async () => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      new Response(
        JSON.stringify({ text: `{"vendor": "PDF業者", "total": 1}` }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const file = makeFile("x.pdf", "application/pdf");
    await extractInvoiceFromFile(file, { fetcher });
    const body = JSON.parse((fetcher.mock.calls[0][1]?.body as string) ?? "{}");
    expect(body.mediaType).toBe("application/pdf");
  });
});
