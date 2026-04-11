/**
 * freee会計API連携 — インターフェースとモック実装。
 * 実際のfreee APIはまだ呼ばない。API keyが来たら本実装に差し替える。
 */

// ── 型定義 ────────────────────────────────────────────

export type FreeeInvoice = {
  id: string;
  partnerId: string;
  partnerName: string;
  invoiceNumber: string;
  totalAmount: number;
  dueDate: string; // ISO 8601 (YYYY-MM-DD)
  status: "draft" | "sent" | "paid" | "overdue";
};

export type FreeePayment = {
  id: string;
  invoiceId: string;
  amount: number;
  paidAt: string; // ISO 8601 (YYYY-MM-DD)
  method: string; // e.g. "bank_transfer", "credit_card", "cash"
};

export type FreeeExpense = {
  id: string;
  date: string; // ISO 8601 (YYYY-MM-DD)
  amount: number;
  category: string;
  description: string;
  receiptUrl?: string;
};

// ── インターフェース ────────────────────────────────────

export interface FreeeClient {
  authenticate(clientId: string, clientSecret: string): Promise<void>;
  getInvoices(): Promise<FreeeInvoice[]>;
  getPayments(invoiceId: string): Promise<FreeePayment[]>;
  getExpenses(): Promise<FreeeExpense[]>;
  createExpense(
    expense: Omit<FreeeExpense, "id">,
  ): Promise<FreeeExpense>;
}

// ── カテゴリ推定 ────────────────────────────────────────

const CATEGORY_KEYWORDS: { category: string; keywords: string[] }[] = [
  { category: "交通費", keywords: ["電車", "バス", "タクシー", "新幹線", "交通", "電車代", "乗車"] },
  { category: "宿泊費", keywords: ["ホテル", "旅館", "宿泊", "ビジネスホテル"] },
  { category: "飲食費", keywords: ["ランチ", "ディナー", "食事", "懇親会", "会食", "弁当", "飲み会", "カフェ", "昼食", "夕食"] },
  { category: "消耗品費", keywords: ["文具", "用紙", "ボールペン", "プリンター", "消耗品", "事務用品"] },
  { category: "通信費", keywords: ["電話", "インターネット", "携帯", "スマホ", "通信", "Wi-Fi", "ネット"] },
  { category: "外注費", keywords: ["外注", "委託", "業務委託", "下請け", "協力会社"] },
  { category: "工具・資材費", keywords: ["工具", "資材", "材料", "部品", "ネジ", "接着剤", "塗料", "工事", "内装"] },
  { category: "その他", keywords: [] },
];

/**
 * 説明文からfreeeカテゴリを推定する。
 * マッチしない場合は「その他」を返す。
 */
export function categorizeExpense(description: string): string {
  const lower = description.toLowerCase();
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return "その他";
}

// ── 未払いチェック ──────────────────────────────────────

/**
 * 請求書一覧から未振込（sent / overdue）のものだけを返す。
 */
export function checkUnpaidInvoices(invoices: FreeeInvoice[]): FreeeInvoice[] {
  return invoices.filter(
    (inv) => inv.status === "sent" || inv.status === "overdue",
  );
}

// ── MockFreeeClient ────────────────────────────────────

export class MockFreeeClient implements FreeeClient {
  private authenticated = false;
  private invoices: FreeeInvoice[] = [];
  private payments: Map<string, FreeePayment[]> = new Map();
  private expenses: FreeeExpense[] = [];
  private nextId = 1;

  async authenticate(_clientId: string, _clientSecret: string): Promise<void> {
    this.authenticated = true;
  }

  async getInvoices(): Promise<FreeeInvoice[]> {
    this._requireAuth();
    return [...this.invoices];
  }

  async getPayments(invoiceId: string): Promise<FreeePayment[]> {
    this._requireAuth();
    return [...(this.payments.get(invoiceId) ?? [])];
  }

  async getExpenses(): Promise<FreeeExpense[]> {
    this._requireAuth();
    return [...this.expenses];
  }

  async createExpense(data: Omit<FreeeExpense, "id">): Promise<FreeeExpense> {
    this._requireAuth();
    const expense: FreeeExpense = { id: `exp-${this.nextId++}`, ...data };
    this.expenses.push(expense);
    return expense;
  }

  // ── テスト補助: データ注入 ──────────────────────────────

  /** テスト用: 請求書を直接追加 */
  seedInvoice(invoice: FreeeInvoice): void {
    this.invoices.push(invoice);
  }

  /** テスト用: 入金を直接追加 */
  seedPayment(payment: FreeePayment): void {
    const list = this.payments.get(payment.invoiceId) ?? [];
    list.push(payment);
    this.payments.set(payment.invoiceId, list);
  }

  /** テスト用: 全データリセット */
  reset(): void {
    this.authenticated = false;
    this.invoices = [];
    this.payments = new Map();
    this.expenses = [];
    this.nextId = 1;
  }

  private _requireAuth(): void {
    if (!this.authenticated) {
      throw new Error("FreeeClient: not authenticated");
    }
  }
}
