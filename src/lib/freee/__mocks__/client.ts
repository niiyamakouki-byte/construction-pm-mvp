/**
 * freee Client テスト用モック
 *
 * vi.mock("../client.js") で差し替えるか、テスト内で直接 import して使う。
 * createMockFreeeClient() でテストごとにリセット可能なインスタンスを生成する。
 */

import type { Company, Deal, DealInput, Invoice, Wallet } from "../types.js";

// ── デフォルトフィクスチャ ──────────────────────────────

export const MOCK_COMPANY: Company = {
  id: 1,
  name: "株式会社テスト建設",
  display_name: "テスト建設",
  role: "admin",
};

export const MOCK_DEAL: Deal = {
  id: 100,
  company_id: 1,
  issue_date: "2026-04-01",
  amount: 5_000_000,
  type: "income",
  status: "unsettled",
  ref_number: "proj-001",
  details: [
    {
      id: 1,
      account_item_id: 1,
      tax_code: 21,
      amount: 5_000_000,
      description: "テスト案件",
    },
  ],
};

export const MOCK_INVOICE: Invoice = {
  id: 200,
  company_id: 1,
  issue_date: "2026-04-15",
  invoice_number: "INV-2026-001",
  total_amount: 1_100_000,
  total_vat: 100_000,
  sub_total: 1_000_000,
  invoice_status: "submitted",
  invoice_lines: [],
};

export const MOCK_WALLET: Wallet = {
  id: 300,
  name: "三菱UFJ普通",
  type: "bank_account",
};

// ── OAuthTokenStore モック ─────────────────────────────

export function createMockTokenStore(opts: {
  accessToken?: string;
  expiringSoon?: boolean;
  refreshToken?: string;
} = {}) {
  let currentToken = opts.accessToken ?? "mock-access-token";
  const expiringSoon = opts.expiringSoon ?? false;

  return {
    getAccessToken: () => currentToken,
    isExpiringSoon: () => expiringSoon,
    refresh: async () => {
      currentToken = "mock-refreshed-token";
      return currentToken;
    },
    _setToken: (t: string) => { currentToken = t; },
  };
}

// ── FreeeClient モック ─────────────────────────────────

export type MockFreeeClientOptions = {
  configured?: boolean;
  companies?: Company[];
  deals?: Deal[];
  invoices?: Invoice[];
  wallets?: Wallet[];
  /** createDeal が呼ばれたときに返す Deal（省略時は MOCK_DEAL） */
  createdDeal?: Deal;
  /** API エラーをシミュレートする場合は true */
  shouldError?: boolean;
};

export class MockFreeeClient {
  private readonly opts: Required<MockFreeeClientOptions>;

  /** createDeal に渡された引数を記録（スパイ用） */
  public readonly createDealCalls: Array<{ companyId: number; deal: DealInput }> = [];

  constructor(opts: MockFreeeClientOptions = {}) {
    this.opts = {
      configured: true,
      companies: [MOCK_COMPANY],
      deals: [MOCK_DEAL],
      invoices: [MOCK_INVOICE],
      wallets: [MOCK_WALLET],
      createdDeal: { ...MOCK_DEAL, id: 101 },
      shouldError: false,
      ...opts,
    };
  }

  isConfigured(): boolean {
    return this.opts.configured;
  }

  async getCompanies(): Promise<Company[]> {
    if (this.opts.shouldError) throw new Error("mock: API error");
    return this.opts.companies;
  }

  async listDeals(companyId: number): Promise<Deal[]> {
    if (this.opts.shouldError) throw new Error("mock: API error");
    return this.opts.deals.filter((d) => d.company_id === companyId || true);
  }

  async createDeal(companyId: number, deal: DealInput): Promise<Deal> {
    if (this.opts.shouldError) throw new Error("mock: API error");
    this.createDealCalls.push({ companyId, deal });
    return this.opts.createdDeal;
  }

  async listInvoices(companyId: number): Promise<Invoice[]> {
    if (this.opts.shouldError) throw new Error("mock: API error");
    return this.opts.invoices.filter((i) => i.company_id === companyId || true);
  }

  async listWallets(companyId: number): Promise<Wallet[]> {
    if (this.opts.shouldError) throw new Error("mock: API error");
    return this.opts.wallets.filter((w) => typeof companyId === "number" || true);
  }
}

/**
 * テストごとにリセットされる MockFreeeClient を生成するファクトリ。
 *
 * @example
 *   const client = createMockFreeeClient({ deals: [] });
 *   const result = await syncProjectToFreee(client as unknown as FreeeClient, 1, project);
 */
export function createMockFreeeClient(opts: MockFreeeClientOptions = {}): MockFreeeClient {
  return new MockFreeeClient(opts);
}
