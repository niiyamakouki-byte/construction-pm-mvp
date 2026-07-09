/**
 * POST /api/freee/sync-payment-plans?company_id=...&project_id=...
 *
 * project_payment_plans.freee_deal_id を freee 取引と照合し、
 * settled になっていれば status='paid' + actual_amount + actual_paid_date を更新する。
 *
 * - company_id: 必須 (freee 事業所ID)
 * - project_id: 任意 (指定時はそのプロジェクトのみ同期)
 * - 認証: Authorization: Bearer <supabase jwt>
 *
 * Task #41: プロジェクト単位の入金計画 freee 連携。
 */

import { createClient } from "@supabase/supabase-js";
import {
  asSupabaseAuthVerifier,
  verifyBearerAuth,
} from "../../src/lib/auth-helper.js";
import { FreeeApi, type StoredFreeeToken, type TokenStore } from "../../src/lib/freee-api.js";

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

type PaymentPlanRow = {
  id: string;
  project_id: string;
  freee_deal_id: string;
  scheduled_amount: number;
  status: string;
};

function getQueryValue(req: Req, key: string): string | undefined {
  const v = req.query?.[key];
  if (Array.isArray(v)) return v[0];
  return typeof v === "string" ? v : undefined;
}

export default async function handler(req: Req, res: Res): Promise<void> {
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
