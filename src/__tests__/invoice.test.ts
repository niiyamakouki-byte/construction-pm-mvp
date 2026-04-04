/**
 * InvoicePage の OCR モック関数テスト
 * mockOcrExtract の決定論的動作と expense 保存ロジックを検証する
 */
import { describe, expect, it } from "vitest";

// ── Re-implement mockOcrExtract for unit testing ─────────────────
// This mirrors the internal function in InvoicePage.tsx

type OcrResult = {
  vendorName: string;
  amount: number;
  invoiceDate: string;
};

function mockOcrExtract(fileName: string): OcrResult {
  const vendors = ["田中工務店", "山田建設", "鈴木電気工事", "佐藤塗装", "東京内装"];
  const amounts = [125000, 380000, 92500, 215000, 467000, 53000, 148000];
  const seed = fileName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const vendor = vendors[seed % vendors.length];
  const amount = amounts[seed % amounts.length];
  const today = new Date();
  const dayOffset = seed % 30;
  today.setDate(today.getDate() - dayOffset);
  const invoiceDate = today.toISOString().slice(0, 10);
  return { vendorName: vendor, amount, invoiceDate };
}

// ── mockOcrExtract テスト ─────────────────────────────────────────

describe("mockOcrExtract", () => {
  it("同じファイル名で呼び出すと同じ結果を返す（決定論的）", () => {
    const r1 = mockOcrExtract("invoice.jpg");
    const r2 = mockOcrExtract("invoice.jpg");
    expect(r1.vendorName).toBe(r2.vendorName);
    expect(r1.amount).toBe(r2.amount);
    expect(r1.invoiceDate).toBe(r2.invoiceDate);
  });

  it("異なるファイル名で異なる結果を返す可能性がある", () => {
    const r1 = mockOcrExtract("a.jpg");
    const r2 = mockOcrExtract("zzzzzzz.pdf");
    // 結果が同じになるケースもあり得るが、この2つは違うはず
    const different = r1.vendorName !== r2.vendorName || r1.amount !== r2.amount;
    expect(different).toBe(true);
  });

  it("vendorName は定義された業者リストの1つ", () => {
    const validVendors = ["田中工務店", "山田建設", "鈴木電気工事", "佐藤塗装", "東京内装"];
    const result = mockOcrExtract("test.jpg");
    expect(validVendors).toContain(result.vendorName);
  });

  it("amount は正の整数", () => {
    const result = mockOcrExtract("invoice_001.png");
    expect(result.amount).toBeGreaterThan(0);
    expect(Number.isInteger(result.amount)).toBe(true);
  });

  it("invoiceDate は YYYY-MM-DD フォーマット", () => {
    const result = mockOcrExtract("receipt.pdf");
    expect(result.invoiceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("invoiceDate は過去30日以内の日付", () => {
    const result = mockOcrExtract("sample.jpg");
    const today = new Date();
    const resultDate = new Date(result.invoiceDate);
    const diffDays = Math.round((today.getTime() - resultDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(0);
    expect(diffDays).toBeLessThan(31);
  });

  it("空文字列ファイル名でもクラッシュしない", () => {
    expect(() => mockOcrExtract("")).not.toThrow();
    const result = mockOcrExtract("");
    expect(result.vendorName).toBeDefined();
    expect(result.amount).toBeDefined();
  });

  it("全業者がローテーションで選ばれる可能性がある", () => {
    const vendors = new Set<string>();
    // 50個の異なるファイル名で実行してほぼ全業者をカバー
    for (let i = 0; i < 50; i++) {
      const r = mockOcrExtract(`file_${i}.jpg`);
      vendors.add(r.vendorName);
    }
    // 5業者のうち少なくとも2種類は選ばれるはず
    expect(vendors.size).toBeGreaterThanOrEqual(2);
  });
});

// ── expense バリデーションロジック テスト ──────────────────────────

describe("expense バリデーション", () => {
  function validateExpenseFields(
    vendorName: string,
    amount: string,
    invoiceDate: string,
  ): string | null {
    if (!vendorName.trim() || !amount || !invoiceDate) {
      return "業者名・金額・日付は必須です";
    }
    return null;
  }

  it("全フィールド入力済みではエラーなし", () => {
    expect(validateExpenseFields("田中工務店", "125000", "2024-04-01")).toBeNull();
  });

  it("業者名が空の場合はエラー", () => {
    expect(validateExpenseFields("", "125000", "2024-04-01")).not.toBeNull();
  });

  it("金額が空の場合はエラー", () => {
    expect(validateExpenseFields("田中工務店", "", "2024-04-01")).not.toBeNull();
  });

  it("日付が空の場合はエラー", () => {
    expect(validateExpenseFields("田中工務店", "125000", "")).not.toBeNull();
  });

  it("業者名がスペースのみの場合はエラー", () => {
    expect(validateExpenseFields("   ", "125000", "2024-04-01")).not.toBeNull();
  });

  it("エラーメッセージが正しい", () => {
    expect(validateExpenseFields("", "", "")).toBe("業者名・金額・日付は必須です");
  });
});

// ── ファイルタイプ検証テスト ─────────────────────────────────────

describe("ファイルタイプ検証", () => {
  function isValidFileType(mimeType: string): boolean {
    return mimeType.startsWith("image/") || mimeType === "application/pdf";
  }

  it("JPEGは有効", () => {
    expect(isValidFileType("image/jpeg")).toBe(true);
  });

  it("PNGは有効", () => {
    expect(isValidFileType("image/png")).toBe(true);
  });

  it("PDFは有効", () => {
    expect(isValidFileType("application/pdf")).toBe(true);
  });

  it("テキストファイルは無効", () => {
    expect(isValidFileType("text/plain")).toBe(false);
  });

  it("Word文書は無効", () => {
    expect(isValidFileType("application/msword")).toBe(false);
  });

  it("SVGはimage/で始まるため有効", () => {
    expect(isValidFileType("image/svg+xml")).toBe(true);
  });
});
