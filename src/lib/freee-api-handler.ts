/**
 * /api/freee/{companies,invoices,deals} の共有ハンドラ。
 *
 * 認証ユーザーの Supabase JWT を検証し、保管された freee トークンで
 * FreeeApi を組み立てて呼び出す。
 */

import { verifyBearerAuth } from "./auth-helper.js";
import { FreeeApi, type StoredFreeeToken, type TokenStore } from "./freee-api.js";

type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

// ── Supabase 依存の抽象 ─────────────────────────────

type TokenRow = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

type UpsertError = { error: { message: string } | null };

export type SupabaseFreeeBinding = {
  auth: Parameters<typeof verifyBearerAuth>[0];
  loadToken(userId: string): Promise<TokenRow | null>;
  saveToken(userId: string, token: StoredFreeeToken): Promise<UpsertError>;
};

// ── 環境変数 ────────────────────────────────────────

export type FreeeEnv = {
  clientId: string;
  clientSecret: string;
};

// ── endpoint kinds ─────────────────────────────────

export type FreeeEndpoint = "companies" | "invoices" | "deals";

// ── メインハンドラ ──────────────────────────────────

export async function handleFreeeRequest(
  req: Req,
  res: Res,
  endpoint: FreeeEndpoint,
  binding: SupabaseFreeeBinding,
  env: FreeeEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "GET のみ受け付けます" });
    return;
  }

  const authResult = await verifyBearerAuth(binding.auth, req.headers);
  if (!authResult.ok) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const userId = authResult.user.id;

  const store: TokenStore = {
    async load() {
      const row = await binding.loadToken(userId);
      if (!row) return null;
      return {
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        expiresAt: row.expires_at,
      };
    },
    async save(token) {
      const result = await binding.saveToken(userId, token);
      if (result.error) {
        throw new Error(`freee token 更新に失敗しました: ${result.error.message}`);
      }
    },
  };

  const api = new FreeeApi({
    store,
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    fetchImpl,
  });

  try {
    if (endpoint === "companies") {
      const companies = await api.getCompanies();
      res.status(200).json({ companies });
      return;
    }

    const companyId = pickCompanyId(req);
    if (companyId === null) {
      res.status(400).json({ error: "company_id クエリが必要です" });
      return;
    }

    if (endpoint === "invoices") {
      const invoices = await api.getInvoices(companyId, pickListParams(req));
      res.status(200).json({ invoices });
      return;
    }

    const deals = await api.getDeals(companyId, pickListParams(req));
    res.status(200).json({ deals });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    if (message.includes("freee未連携")) {
      res.status(409).json({ error: "freee と未連携です。/freee から連携してください" });
      return;
    }
    console.error(`[freee/${endpoint}] failed:`, err);
    res.status(502).json({ error: `freee API 呼び出しに失敗しました: ${message}` });
  }
}

// ── helpers ─────────────────────────────────────────

function getQueryValue(
  req: Req,
  key: string,
): string | undefined {
  const v = req.query?.[key];
  if (Array.isArray(v)) return v[0];
  return typeof v === "string" ? v : undefined;
}

function pickCompanyId(req: Req): number | null {
  const raw = getQueryValue(req, "company_id");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function pickListParams(req: Req): Record<string, string | number | undefined> {
  const params: Record<string, string | number | undefined> = {};
  for (const key of [
    "start_issue_date",
    "end_issue_date",
    "invoice_status",
    "partner_id",
    "type",
    "status",
    "offset",
    "limit",
  ]) {
    const v = getQueryValue(req, key);
    if (v !== undefined) params[key] = v;
  }
  return params;
}
