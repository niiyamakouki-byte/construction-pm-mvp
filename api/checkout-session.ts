/**
 * Vercel Serverless Function: POST /api/checkout-session
 *
 * Stripe Checkout Session を作成し、リダイレクト先 URL を返す。
 * 環境変数 STRIPE_SECRET_KEY が必要。
 * 本番: sk_live_ プレフィックス必須 / 開発: sk_test_ プレフィックス必須。
 *
 * セキュリティ:
 *   - Authorization: Bearer <supabase jwt> が必須（未認証は 401）
 *   - priceId はクライアントから受け取らず、plan → env var へマッピング
 *   - client_reference_id / customer_email は認証済みユーザーから導出
 *
 * リクエスト body (JSON):
 *   { plan: "standard" | "pro" }
 *
 * レスポンス (JSON):
 *   { sessionId: string, url: string }
 */
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  createCheckoutSession,
  type CheckoutPlanId,
} from "../src/lib/checkout-session.js";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function getAppBaseUrl(req: VercelRequest): string {
  const configured = process.env.APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const hostStr = Array.isArray(host) ? host[0] : host;
  const protoStr = Array.isArray(proto) ? proto[0] : proto;
  if (!hostStr) return "http://localhost:5173";
  return `${protoStr}://${hostStr}`;
}

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (body && typeof body === "object") {
    return body as Record<string, unknown>;
  }
  return {};
}

function extractBearer(req: VercelRequest): string | null {
  const raw = req.headers.authorization ?? req.headers.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

function resolvePriceId(plan: CheckoutPlanId): string | null {
  const id =
    plan === "standard"
      ? process.env.STRIPE_PRICE_STANDARD
      : process.env.STRIPE_PRICE_PRO;
  return id && id.length > 0 ? id : null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "POST のみ受け付けます" });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({
      error:
        "STRIPE_SECRET_KEY が未設定です。Vercel の環境変数を設定してください。",
    });
    return;
  }

  // 本番環境では live キーを必須とし、test キーを禁止する
  if (process.env.NODE_ENV === "production" && !secretKey.startsWith("sk_live_")) {
    res.status(500).json({
      error:
        "本番環境では STRIPE_SECRET_KEY に sk_live_ プレフィックスのキーが必要です。",
    });
    return;
  }
  // 非本番環境では test キーのみ許可
  if (process.env.NODE_ENV !== "production" && !secretKey.startsWith("sk_test_")) {
    res.status(500).json({
      error:
        "開発環境では STRIPE_SECRET_KEY に sk_test_ プレフィックスのキーを使用してください。",
    });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({
      error:
        "SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です。",
    });
    return;
  }

  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: "認証が必要です" });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    res.status(401).json({ error: "認証トークンが無効です" });
    return;
  }
  const authedUser = userData.user;

  const body = parseBody(req.body);
  const plan = body.plan as CheckoutPlanId | undefined;

  if (!plan || (plan !== "standard" && plan !== "pro")) {
    res.status(400).json({ error: "plan は standard または pro を指定してください" });
    return;
  }

  const priceId = resolvePriceId(plan);
  if (!priceId) {
    res.status(500).json({
      error: `${plan} プランの Stripe Price ID が未設定です（STRIPE_PRICE_${plan.toUpperCase()}）`,
    });
    return;
  }

  const stripe = new Stripe(secretKey);
  const baseUrl = getAppBaseUrl(req);

  try {
    const result = await createCheckoutSession(stripe.checkout.sessions, {
      plan,
      priceId,
      successUrl: `${baseUrl}/#/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/#/pricing/cancel`,
      customerEmail: authedUser.email ?? undefined,
      clientReferenceId: authedUser.id,
    });

    // 監査ログ: checkout_sessions テーブルに作成記録を残す（service role 書き込み）
    const { error: auditErr } = await supabase.from("checkout_sessions").insert({
      user_id: authedUser.id,
      plan,
      stripe_session_id: result.sessionId,
      stripe_price_id: priceId,
      mode: "subscription",
      status: "created",
    });
    if (auditErr) {
      // 監査ログ失敗は致命傷にしない（Checkout は成立済）。ログだけ残す。
      console.error("[checkout-session] audit insert failed:", auditErr);
    }

    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    // 本番では Sentry などへ送る想定。ここでは console で十分。
    console.error("[checkout-session] failed:", err);
    res.status(500).json({ error: `Checkout Session 作成に失敗しました: ${message}` });
  }
}
