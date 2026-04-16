/**
 * freee 会計 API クライアント
 * FREEE_ACCESS_TOKEN 環境変数が未設定の場合は全メソッドが no-op を返す。
 */

import type {
  Company,
  CompaniesResponse,
  Deal,
  DealFilter,
  DealInput,
  DealsResponse,
  Invoice,
  InvoiceFilter,
  InvoicesResponse,
  Wallet,
  WalletsResponse,
} from "./types.js";

const FREEE_API_BASE = "https://api.freee.co.jp";

export class FreeeClient {
  private readonly accessToken: string | undefined;

  constructor(accessToken?: string) {
    this.accessToken = accessToken ?? process.env["FREEE_ACCESS_TOKEN"];
  }

  /** FREEE_ACCESS_TOKEN が設定されているか確認する */
  isConfigured(): boolean {
    return !!this.accessToken;
  }

  // ── Private helpers ──────────────────────────────

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(
        "FreeeClient: FREEE_ACCESS_TOKEN is not set. " +
          "Set the environment variable to enable freee API calls.",
      );
    }
  }

  private buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
    const url = new URL(`${FREEE_API_BASE}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    this.assertConfigured();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      "X-Api-Version": "2020-06-15",
    };

    const response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      // Avoid leaking response body (may contain token fragments / account info).
      // Log full body to stderr for debugging, throw sanitized message to caller.
      const text = await response.text().catch(() => "");
      if (text && process.env["FREEE_DEBUG"] === "1") {
        console.error(`[freee] ${method} ${path} ${response.status}: ${text}`);
      }
      throw new Error(`freee API error ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // ── Companies ────────────────────────────────────

  /** GET /api/1/companies — 事業所一覧を取得 */
  async getCompanies(): Promise<Company[]> {
    const url = this.buildUrl("/api/1/companies");
    const data = await this.request<CompaniesResponse>("GET", url);
    return data.companies;
  }

  // ── Deals ────────────────────────────────────────

  /** GET /api/1/deals — 取引一覧を取得 */
  async listDeals(companyId: number, filters?: DealFilter): Promise<Deal[]> {
    const params: Record<string, string | number | undefined> = {
      company_id: companyId,
      ...filters,
    };
    const url = this.buildUrl("/api/1/deals", params);
    const data = await this.request<DealsResponse>("GET", url);
    return data.deals;
  }

  /** POST /api/1/deals — 取引を登録 */
  async createDeal(companyId: number, deal: DealInput): Promise<Deal> {
    const url = this.buildUrl("/api/1/deals");
    const data = await this.request<{ deal: Deal }>("POST", url, {
      company_id: companyId,
      ...deal,
    });
    return data.deal;
  }

  // ── Invoices ─────────────────────────────────────

  /** GET /api/1/invoices — 請求書一覧を取得 */
  async listInvoices(companyId: number, filters?: InvoiceFilter): Promise<Invoice[]> {
    const params: Record<string, string | number | undefined> = {
      company_id: companyId,
      ...filters,
    };
    const url = this.buildUrl("/api/1/invoices", params);
    const data = await this.request<InvoicesResponse>("GET", url);
    return data.invoices;
  }

  // ── Walletables ──────────────────────────────────

  /** GET /api/1/walletables — 口座一覧を取得 */
  async listWallets(companyId: number): Promise<Wallet[]> {
    const url = this.buildUrl("/api/1/walletables", { company_id: companyId });
    const data = await this.request<WalletsResponse>("GET", url);
    return data.walletables;
  }
}
