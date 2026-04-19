/**
 * Vercel Serverless Function: POST /api/checkout-session
 *
 * Stripe Checkout Session を作成し、リダイレクト先 URL を返す。
 * TEST MODE 専用。環境変数 STRIPE_TEST_SECRET_KEY が必要。
 *
 * リクエスト body (JSON):
 *   { plan: "standard" | "pro", priceId: string, customerEmail?: string, clientReferenceId?: string }
 *
 * レスポンス (JSON):
 *   { sessionId: string, url: string }
 *
 * エラー時:
 *   { error: string } + 適切な HTTP ステータス
 */
import Stripe from "stripe";
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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "POST のみ受け付けます" });
    return;
  }

  const secretKey = process.env.STRIPE_TEST_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({
      error:
        "STRIPE_TEST_SECRET_KEY が未設定です。Vercel の環境変数を設定してください。",
    });
    return;
  }

  const body = parseBody(req.body);
  const plan = body.plan as CheckoutPlanId | undefined;
  const priceId = body.priceId as string | undefined;
  const customerEmail = body.customerEmail as string | undefined;
  const clientReferenceId = body.clientReferenceId as string | undefined;

  if (!plan || (plan !== "standard" && plan !== "pro")) {
    res.status(400).json({ error: "plan は standard または pro を指定してください" });
    return;
  }
  if (!priceId || typeof priceId !== "string") {
    res.status(400).json({ error: "priceId は必須です" });
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
      customerEmail,
      clientReferenceId,
    });
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    // 本番では Sentry などへ送る想定。ここでは console で十分。
    console.error("[checkout-session] failed:", err);
    res.status(500).json({ error: `Checkout Session 作成に失敗しました: ${message}` });
  }
}
