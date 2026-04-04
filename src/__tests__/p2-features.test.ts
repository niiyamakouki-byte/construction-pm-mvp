import { describe, expect, it } from "vitest";

// ── CSV parsing tests ─────────────────────────────────────────

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
}

const SAMPLE_CSV = `タスク名,カテゴリ,開始日,終了日,担当業者,材料,リードタイム日数
墨出し・下地確認,内装,2024-04-01,2024-04-02,田中工務店,,0
解体・撤去,内装,2024-04-02,2024-04-05,田中工務店,,1
下地工事,内装,2024-04-05,2024-04-10,山田建設,石膏ボード,2
`;

describe("CSVパース", () => {
  it("ヘッダー行をパースできる", () => {
    const rows = parseCSV(SAMPLE_CSV);
    expect(rows).toHaveLength(3);
  });

  it("タスク名を正しく取得できる", () => {
    const rows = parseCSV(SAMPLE_CSV);
    expect(rows[0]["タスク名"]).toBe("墨出し・下地確認");
    expect(rows[1]["タスク名"]).toBe("解体・撤去");
  });

  it("日付フィールドを正しく取得できる", () => {
    const rows = parseCSV(SAMPLE_CSV);
    expect(rows[0]["開始日"]).toBe("2024-04-01");
    expect(rows[0]["終了日"]).toBe("2024-04-02");
  });

  it("材料フィールドを取得できる", () => {
    const rows = parseCSV(SAMPLE_CSV);
    expect(rows[2]["材料"]).toBe("石膏ボード");
  });

  it("リードタイムを数値に変換できる", () => {
    const rows = parseCSV(SAMPLE_CSV);
    expect(Number(rows[1]["リードタイム日数"])).toBe(1);
    expect(Number(rows[2]["リードタイム日数"])).toBe(2);
  });

  it("空のCSVは空配列を返す", () => {
    expect(parseCSV("")).toHaveLength(0);
  });

  it("ヘッダーのみは空配列を返す", () => {
    expect(parseCSV("タスク名,カテゴリ")).toHaveLength(0);
  });
});

// ── Mock OCR tests ─────────────────────────────────────────────

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
  const today = new Date("2024-04-01");
  const dayOffset = seed % 30;
  today.setDate(today.getDate() - dayOffset);
  const invoiceDate = today.toISOString().slice(0, 10);
  return { vendorName: vendor, amount, invoiceDate };
}

describe("モックOCR", () => {
  it("業者名を返す", () => {
    const result = mockOcrExtract("invoice.jpg");
    expect(vendors).toContain(result.vendorName);
  });

  it("金額を返す", () => {
    const result = mockOcrExtract("invoice.jpg");
    expect(result.amount).toBeGreaterThan(0);
  });

  it("日付フォーマットがYYYY-MM-DDである", () => {
    const result = mockOcrExtract("invoice.jpg");
    expect(result.invoiceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("同じファイル名で同じ結果を返す（決定論的）", () => {
    const r1 = mockOcrExtract("test.pdf");
    const r2 = mockOcrExtract("test.pdf");
    expect(r1).toEqual(r2);
  });

  it("異なるファイル名で異なる結果を返す可能性がある", () => {
    // Just verify they both produce valid results
    const r1 = mockOcrExtract("aaa.jpg");
    const r2 = mockOcrExtract("zzz.jpg");
    expect(r1.amount).toBeGreaterThan(0);
    expect(r2.amount).toBeGreaterThan(0);
  });
});

const vendors = ["田中工務店", "山田建設", "鈴木電気工事", "佐藤塗装", "東京内装"];

// ── Budget usage calculation tests ─────────────────────────────

function calcBudgetUsage(budget: number, totalExpenses: number) {
  if (budget <= 0) return 0;
  return Math.round((totalExpenses / budget) * 100);
}

function budgetBarColor(pct: number): string {
  if (pct > 80) return "red";
  if (pct > 50) return "yellow";
  return "green";
}

describe("予算消化率計算", () => {
  it("50%以下は緑", () => {
    expect(budgetBarColor(calcBudgetUsage(1000000, 400000))).toBe("green");
    expect(budgetBarColor(calcBudgetUsage(1000000, 500000))).toBe("green");
  });

  it("50%超80%以下は黄", () => {
    expect(budgetBarColor(calcBudgetUsage(1000000, 600000))).toBe("yellow");
    expect(budgetBarColor(calcBudgetUsage(1000000, 800000))).toBe("yellow");
  });

  it("80%超は赤", () => {
    expect(budgetBarColor(calcBudgetUsage(1000000, 850000))).toBe("red");
    expect(budgetBarColor(calcBudgetUsage(1000000, 1100000))).toBe("red");
  });

  it("予算0の場合は0を返す", () => {
    expect(calcBudgetUsage(0, 100000)).toBe(0);
  });

  it("支出0の場合は0%", () => {
    expect(calcBudgetUsage(1000000, 0)).toBe(0);
  });

  it("端数は四捨五入される", () => {
    expect(calcBudgetUsage(300000, 100000)).toBe(33);
  });
});

// ── Canvas position tests ─────────────────────────────────────

describe("キャンバス座標", () => {
  it("タスクにcanvasX/canvasYを保持できる", () => {
    const task = {
      id: "1",
      name: "test",
      canvasX: 100,
      canvasY: 200,
    };
    expect(task.canvasX).toBe(100);
    expect(task.canvasY).toBe(200);
  });

  it("デフォルト座標計算（グリッドレイアウト）", () => {
    function getDefaultPos(index: number) {
      const col = index % 4;
      const row = Math.floor(index / 4);
      return { x: col * 220 + 20, y: row * 120 + 20 };
    }
    expect(getDefaultPos(0)).toEqual({ x: 20, y: 20 });
    expect(getDefaultPos(4)).toEqual({ x: 20, y: 140 });
    expect(getDefaultPos(3)).toEqual({ x: 680, y: 20 });
  });
});
