/**
 * freee 会計 API クライアント
 *
 * 2 つのモードをサポート:
 *   1. 静的トークン: FREEE_ACCESS_TOKEN 環境変数（サーバー側 / CI 用）
 *   2. OAuth トークン: OAuthTokenStore を注入してブラウザ側で自動リフレッシュ
 *
 * OAuthTokenStore を使う場合:
 *   - expires_at の 5 分前に自動 refresh
 *   - 401 レスポンス → refresh して 1 回リトライ
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
import {
  FREEE_TOKEN_ENDPOINT,
} from "../freee-client.js";

const FREEE_API_BASE = "https://api.freee.co.jp";

/** OAuth トークン保持・更新の最小インターフェース */
export type OAuthTokenStore = {
  /** 現在の access_token を返す。期限切れなら null。 */
  getAccessToken(): string | null;
  /** refresh_token を使って新しいトークンを取得し保存する。更新後の access_token を返す。 */
  refresh(): Promise<string>;
  /** 5 分以内に期限切れになるか確認する */
  isExpiringSoon(): boolean;
};

/** localStorage ベースの OAuthTokenStore 実装 */
export class LocalStorageTokenStore implements OAuthTokenStore {
  private static readonly KEY_ACCESS = "freee_access_token";
  private static readonly KEY_REFRESH = "freee_refresh_token";
  private static readonly KEY_EXPIRES = "freee_expires_at";
  /** 期限切れ判定の余裕（ミリ秒）= 5 分 */
  private static readonly REFRESH_MARGIN_MS = 5 * 60 * 1000;

  constructor(
    private readonly clientId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  getAccessToken(): string | null {
    const token = localStorage.getItem(LocalStorageTokenStore.KEY_ACCESS);
    const expiresAt = localStorage.getItem(LocalStorageTokenStore.KEY_EXPIRES);
    if (!token || !expiresAt) return null;
    const expiresMs = new Date(expiresAt).getTime();
    if (Date.now() >= expiresMs) return null;
    return token;
  }

  isExpiringSoon(): boolean {
    const expiresAt = localStorage.getItem(LocalStorageTokenStore.KEY_EXPIRES);
    if (!expiresAt) return true;
    const expiresMs = new Date(expiresAt).getTime();
    return Date.now() >= expiresMs - LocalStorageTokenStore.REFRESH_MARGIN_MS;
  }

  async refresh(): Promise<string> {
    const refreshToken = localStorage.getItem(LocalStorageTokenStore.KEY_REFRESH);
    if (!refreshToken) throw new Error("freee: refresh_token が見つかりません。再認証が必要です。");

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      refresh_token: refreshToken,
    });

    const res = await this.fetchImpl(FREEE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`freee token refresh failed: ${res.status}${text ? ` ${text}` : ""}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      created_at?: number;
    };

    const baseMs = typeof data.created_at === "number" ? data.created_at * 1000 : Date.now();
    const expiresAt = new Date(baseMs + data.expires_in * 1000).toISOString();

    localStorage.setItem(LocalStorageTokenStore.KEY_ACCESS, data.access_token);
    localStorage.setItem(LocalStorageTokenStore.KEY_REFRESH, data.refresh_token);
    localStorage.setItem(LocalStorageTokenStore.KEY_EXPIRES, expiresAt);

    return data.access_token;
  }

  /** トークンを localStorage に保存する（OAuth callback 後に呼ぶ） */
  save(params: { accessToken: string; refreshToken: string; expiresAt: string }): void {
    localStorage.setItem(LocalStorageTokenStore.KEY_ACCESS, params.accessToken);
    localStorage.setItem(LocalStorageTokenStore.KEY_REFRESH, params.refreshToken);
    localStorage.setItem(LocalStorageTokenStore.KEY_EXPIRES, params.expiresAt);
  }

  /** localStorage からトークンを削除する（切断時に呼ぶ） */
  clear(): void {
    localStorage.removeItem(LocalStorageTokenStore.KEY_ACCESS);
    localStorage.removeItem(LocalStorageTokenStore.KEY_REFRESH);
    localStorage.removeItem(LocalStorageTokenStore.KEY_EXPIRES);
  }
}

export class FreeeClient {
  private readonly staticToken: string | undefined;
  private readonly tokenStore: OAuthTokenStore | undefined;

  constructor(accessTokenOrStore?: string | OAuthTokenStore) {
    if (typeof accessTokenOrStore === "string") {
      this.staticToken = accessTokenOrStore;
    } else if (accessTokenOrStore != null) {
      this.tokenStore = accessTokenOrStore;
    } else {
      this.staticToken = typeof process !== "undefined"
        ? process.env["FREEE_ACCESS_TOKEN"]
        : undefined;
    }
  }

  /** トークンが設定されているか確認する */
  isConfigured(): boolean {
    if (this.staticToken) return true;
    if (this.tokenStore) {
      return this.tokenStore.getAccessToken() !== null || true; // store 自体があれば設定済み
    }
    return false;
  }

  // ── Private helpers ──────────────────────────────

  private assertConfigured(): void {
    if (!this.staticToken && !this.tokenStore) {
      throw new Error(
        "FreeeClient: アクセストークンが未設定です。" +
          "FREEE_ACCESS_TOKEN 環境変数を設定するか、OAuthTokenStore を注入してください。",
      );
    }
  }

  /** 有効なアクセストークンを返す。必要なら事前に refresh する。 */
  private async resolveToken(): Promise<string> {
    if (this.staticToken) return this.staticToken;
    if (!this.tokenStore) {
      throw new Error("FreeeClient: トークンが未設定です。");
    }
    // 期限 5 分前に先行 refresh
    if (this.tokenStore.isExpiringSoon()) {
      return this.tokenStore.refresh();
    }
    const token = this.tokenStore.getAccessToken();
    if (!token) {
      return this.tokenStore.refresh();
    }
    return token;
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

    const token = await this.resolveToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Api-Version": "2020-06-15",
    };

    const response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // 401 → refresh して 1 回だけリトライ
    if (response.status === 401 && this.tokenStore) {
      const newToken = await this.tokenStore.refresh();
      const retryResponse = await fetch(path, {
        method,
        headers: {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!retryResponse.ok) {
        const text = await retryResponse.text().catch(() => "");
        if (text && typeof process !== "undefined" && process.env["FREEE_DEBUG"] === "1") {
          console.error(`[freee] retry ${method} ${path} ${retryResponse.status}: ${text}`);
        }
        throw new Error(`freee API error ${retryResponse.status}`);
      }
      return retryResponse.json() as Promise<T>;
    }

    if (!response.ok) {
      // Avoid leaking response body (may contain token fragments / account info).
      const text = await response.text().catch(() => "");
      if (text && typeof process !== "undefined" && process.env["FREEE_DEBUG"] === "1") {
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
