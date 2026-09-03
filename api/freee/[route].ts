/**
 * /api/freee/* 統合ルーター
 *
 * GET  /api/freee/companies | /api/freee/deals | /api/freee/invoices
 * GET  /api/freee/auth
 * POST /api/freee/callback
 * POST /api/freee/sync-payment-plans
 * POST /api/freee/webhook
 *
 * Vercel Hobby プランの Serverless Functions 上限(12)対応で
 * auth.ts / callback.ts / sync-payment-plans.ts / webhook.ts /
 * [resource].ts (旧 companies/deals/invoices 統合済み) の計5関数を
 * 1関数(単一動的セグメント `[route]`、既存の [action].ts 系と同じ規約)へ再統合。
 * URL パス・メソッド・レスポンス形は変更なし（挙動は完全維持）。
 * webhook は JSON body のみを扱い raw body 署名検証は不要なため、
 * ここへの統合で安全性上の懸念はない（stripe-webhook は対象外・維持）。
 *
 * 必須 env（エンドポイントにより異なる）:
 *   VITE_FREEE_CLIENT_ID / FREEE_CLIENT_SECRET / FREEE_REDIRECT_URI /
 *   FREEE_WEBHOOK_TOKEN / DISCORD_WEBHOOK_URL_KEIHI /
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import {
  asSupabaseAuthVerifier,
  verifyBearerAuth,
} from "../../src/lib/auth-helper.js";
import { handleFreeeRequest, type FreeeEndpoint } from "../../src/lib/freee-api-handler.js";
import { FreeeApi, type StoredFreeeToken, type TokenStore } from "../../src/lib/freee-api.js";
import { buildConsentRedirect, handleOAuthCallback } from "../../src/lib/freee-oauth-handler.js";
import {
  tokensMatch,
  formatDiscordContent,
  postToDiscord,
  type FreeePayload,
} from "../../src/lib/freee-webhook.js";

type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const VALID_RESOURCES: readonly FreeeEndpoint[] = ["companies", "deals", "invoices"];

function isFreeeEndpoint(value: string): value is FreeeEndpoint {
  return (VALID_RESOURCES as readonly string[]).includes(value);
}

function getRouteSegment(req: Req): string | undefined {
  const raw = req.query?.route;
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
}

function getQueryValue(req: Req, key: string): string | undefined {
  const v = req.query?.[key];
  if (Array.isArray(v)) return v[0];
  return typeof v === "string" ? v : undefined;
}

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (body && typeof body === "object") return body as Record<string, unknown>;
  return {};
}

function headerStr(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

// ── GET /api/freee/companies | deals | invoices ──
async function handleResource(req: Req, res: Res, resource: FreeeEndpoint): Promise<void> {
  const clientId = process.env.VITE_FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clientId || !clientSecret || !supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "freee / Supabase 環境変数が未設定です" });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await handleFreeeRequest(
    req,
    res,
    resource,
    {
      auth: asSupabaseAuthVerifier(supabase.auth),
      async loadToken(userId) {
        const { data } = await supabase
          .from("freee_tokens")
          .select("access_token, refresh_token, expires_at")
          .eq("user_id", userId)
          .maybeSingle();
        return data ?? null;
      },
      async saveToken(userId, token: StoredFreeeToken) {
        return supabase.from("freee_tokens").upsert({
          user_id: userId,
          access_token: token.accessToken,
          refresh_token: token.refreshToken,
          expires_at: token.expiresAt,
        });
      },
    },
    { clientId, clientSecret },
  );
}

// ── GET /api/freee/auth ──
async function handleAuth(req: Req, res: Res): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "GET のみ受け付けます" });
    return;
  }

  const clientId = process.env.VITE_FREEE_CLIENT_ID;
  const redirectUri = process.env.FREEE_REDIRECT_URI;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !redirectUri) {
    res.status(500).json({
      error:
        "VITE_FREEE_CLIENT_ID または FREEE_REDIRECT_URI が未設定です（Vercel 環境変数を設定してください）",
    });
    return;
  }
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({
      error: "SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です",
    });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authResult = await verifyBearerAuth(
    asSupabaseAuthVerifier(supabase.auth),
    req.headers,
  );
  if (!authResult.ok) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  // state には user id を入れる。callback では JWT から取り直すので単なる hint。
  const state = authResult.user.id;
  const url = buildConsentRedirect({ clientId, redirectUri, state });

  res.status(200).json({ url });
}

// ── POST /api/freee/callback ──
async function handleCallback(req: Req, res: Res): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "POST のみ受け付けます" });
    return;
  }

  const clientId = process.env.VITE_FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  const redirectUri = process.env.FREEE_REDIRECT_URI;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !clientSecret || !redirectUri) {
    res.status(500).json({
      error:
        "freee OAuth の環境変数が未設定です（VITE_FREEE_CLIENT_ID / FREEE_CLIENT_SECRET / FREEE_REDIRECT_URI）",
    });
    return;
  }
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({
      error: "SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です",
    });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authResult = await verifyBearerAuth(
    asSupabaseAuthVerifier(supabase.auth),
    req.headers,
  );
  if (!authResult.ok) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const body = parseBody(req.body);
  const code = typeof body.code === "string" ? body.code : "";
  if (!code) {
    res.status(400).json({ error: "code パラメータが必要です" });
    return;
  }

  try {
    const result = await handleOAuthCallback({
      code,
      userId: authResult.user.id,
      config: { clientId, clientSecret, redirectUri },
      store: supabase.from("freee_tokens"),
    });
    res.status(200).json({
      ok: true,
      expires_at: result.expiresAt,
      scope: result.scope ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error("[freee/callback] failed:", err);
    res.status(500).json({ error: `freee連携に失敗しました: ${message}` });
  }
}

// ── POST /api/freee/sync-payment-plans ──
type PaymentPlanRow = {
  id: string;
  project_id: string;
  freee_deal_id: string;
  scheduled_amount: number;
  status: string;
};

async function handleSyncPaymentPlans(req: Req, res: Res): Promise<void> {
  if (req.method && req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "POST のみ受け付けます" });
    return;
  }

  const clientId = process.env.VITE_FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clientId || !clientSecret || !supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "freee / Supabase 環境変数が未設定です" });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authResult = await verifyBearerAuth(
    asSupabaseAuthVerifier(supabase.auth),
    req.headers,
  );
  if (!authResult.ok) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const userId = authResult.user.id;

  const companyIdRaw = getQueryValue(req, "company_id");
  const companyId = companyIdRaw ? Number(companyIdRaw) : NaN;
  if (!Number.isFinite(companyId)) {
    res.status(400).json({ error: "company_id クエリが必要です" });
    return;
  }
  const projectId = getQueryValue(req, "project_id") ?? null;

  // ── freee トークンロード ──
  const store: TokenStore = {
    async load() {
      const { data } = await supabase
        .from("freee_tokens")
        .select("access_token, refresh_token, expires_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (!data) return null;
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
      };
    },
    async save(token: StoredFreeeToken) {
      const { error } = await supabase.from("freee_tokens").upsert({
        user_id: userId,
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_at: token.expiresAt,
      });
      if (error) throw new Error(`freee token 更新失敗: ${error.message}`);
    },
  };

  const api = new FreeeApi({ store, clientId, clientSecret });

  // ── 対象 plan をロード ──
  let query = supabase
    .from("project_payment_plans")
    .select("id, project_id, freee_deal_id, scheduled_amount, status")
    .not("freee_deal_id", "is", null)
    .neq("status", "paid")
    .neq("status", "cancelled");
  if (projectId) query = query.eq("project_id", projectId);

  const { data: plans, error: plansErr } = await query;
  if (plansErr) {
    res.status(500).json({ error: `plan ロード失敗: ${plansErr.message}` });
    return;
  }
  const targetPlans = (plans ?? []) as PaymentPlanRow[];
  if (targetPlans.length === 0) {
    res.status(200).json({ updated: 0, checked: 0, message: "対象 plan なし" });
    return;
  }

  // ── freee deals 取得 (直近365日, 1回で全件) ──
  let deals;
  try {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);
    const startDate = since.toISOString().slice(0, 10);
    deals = await api.getDeals(companyId, {
      type: "income",
      start_issue_date: startDate,
      limit: 100,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    if (message.includes("freee未連携")) {
      res.status(409).json({ error: "freee と未連携です。/freee から連携してください" });
      return;
    }
    res.status(502).json({ error: `freee API 失敗: ${message}` });
    return;
  }

  const dealMap = new Map<string, (typeof deals)[number]>();
  for (const d of deals) dealMap.set(String(d.id), d);

  // ── 照合して更新 ──
  let updated = 0;
  const errors: Array<{ planId: string; reason: string }> = [];

  for (const plan of targetPlans) {
    const deal = dealMap.get(plan.freee_deal_id);
    if (!deal) continue;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (deal.status === "settled") {
      patch.status = "paid";
      patch.actual_amount = deal.amount;
      patch.actual_paid_date = deal.issue_date;
    } else if (plan.status === "planned") {
      patch.status = "invoiced";
    } else {
      continue; // 変更なし
    }

    const { error: updErr } = await supabase
      .from("project_payment_plans")
      .update(patch)
      .eq("id", plan.id);
    if (updErr) {
      errors.push({ planId: plan.id, reason: updErr.message });
    } else {
      updated += 1;
    }
  }

  res.status(200).json({
    updated,
    checked: targetPlans.length,
    deals_fetched: deals.length,
    errors,
  });
}

// ── POST /api/freee/webhook ──
async function handleWebhook(req: Req, res: Res): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const expectedToken = process.env.FREEE_WEBHOOK_TOKEN;
  const discordUrl = process.env.DISCORD_WEBHOOK_URL_KEIHI;
  if (!expectedToken || !discordUrl) {
    console.error("[freee-webhook] FREEE_WEBHOOK_TOKEN or DISCORD_WEBHOOK_URL_KEIHI not set");
    res.status(500).json({ error: "server not configured" });
    return;
  }

  const receivedToken = headerStr(req.headers["x-freee-token"]);
  if (!tokensMatch(receivedToken, expectedToken)) {
    console.warn("[freee-webhook] invalid x-freee-token");
    res.status(401).json({ error: "invalid token" });
    return;
  }

  const payload: FreeePayload =
    typeof req.body === "object" && req.body !== null
      ? (req.body as FreeePayload)
      : {};

  // ack 即返し → Discord 送信は fire-and-forget
  res.status(200).json({ ok: true });

  try {
    const content = formatDiscordContent(payload);
    await postToDiscord(discordUrl, content);
  } catch (err) {
    console.error("[freee-webhook] discord forward failed:", err);
  }
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const route = getRouteSegment(req);

  if (!route) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (isFreeeEndpoint(route)) {
    await handleResource(req, res, route);
    return;
  }

  switch (route) {
    case "auth":
      await handleAuth(req, res);
      return;
    case "callback":
      await handleCallback(req, res);
      return;
    case "sync-payment-plans":
      await handleSyncPaymentPlans(req, res);
      return;
    case "webhook":
      await handleWebhook(req, res);
      return;
    default:
      res.status(404).json({ error: "Not found" });
  }
}
