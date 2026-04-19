/**
 * Vercel Serverless Function: POST /api/stripe-webhook
 *
 * Stripe イベントを受けて public.subscriptions と public.checkout_sessions を更新する。
 *
 * 必要な環境変数:
 *   - STRIPE_TEST_SECRET_KEY
 *   - STRIPE_WEBHOOK_SECRET       (Stripe ダッシュボードから発行)
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Vercel では Raw body を取得するために bodyParser を無効化する必要がある。
 */
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  on: (event: string, cb: (chunk: Buffer) => void) => void;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));
  });
}

function toIsoOrNull(epochSeconds: number | null | undefined): string | null {
  if (typeof epochSeconds !== "number" || !Number.isFinite(epochSeconds)) {
    return null;
  }
  return new Date(epochSeconds * 1000).toISOString();
}

function planFromPriceId(priceId: string | null | undefined): "standard" | "pro" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STANDARD) return "standard";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return null;
}

async function handleCheckoutCompleted(
  supabase: SupabaseClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.client_reference_id;
  if (!userId) {
    console.warn(`[stripe-webhook] checkout.session.completed missing client_reference_id: ${session.id}`);
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const metadataPlan = session.metadata?.plan;
  let plan: "standard" | "pro" | null =
    metadataPlan === "standard" || metadataPlan === "pro" ? metadataPlan : null;

  let currentPeriodEnd: string | null = null;
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      currentPeriodEnd = toIsoOrNull(sub.current_period_end);
      if (!plan) {
        plan = planFromPriceId(sub.items.data[0]?.price.id);
      }
    } catch (err) {
      console.error("[stripe-webhook] failed to retrieve subscription:", err);
    }
  }

  if (!plan) {
    console.warn(`[stripe-webhook] could not determine plan for session ${session.id}`);
    return;
  }

  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: "active",
        current_period_end: currentPeriodEnd,
      },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("[stripe-webhook] subscriptions upsert failed:", error);
    throw new Error(error.message);
  }

  // 監査ログ側の status / amount_total も更新
  const { error: auditErr } = await supabase
    .from("checkout_sessions")
    .update({
      status: "completed",
      amount_total: session.amount_total,
      currency: session.currency,
    })
    .eq("stripe_session_id", session.id);
  if (auditErr) {
    console.error("[stripe-webhook] checkout_sessions update failed:", auditErr);
  }
}

async function handleSubscriptionUpdated(
  supabase: SupabaseClient,
  sub: Stripe.Subscription,
): Promise<void> {
  const plan = planFromPriceId(sub.items.data[0]?.price.id);
  const update: Record<string, unknown> = {
    status: sub.status,
    current_period_end: toIsoOrNull(sub.current_period_end),
  };
  if (plan) update.plan = plan;

  const { error } = await supabase
    .from("subscriptions")
    .update(update)
    .eq("stripe_subscription_id", sub.id);
  if (error) {
    console.error("[stripe-webhook] subscriptions update failed:", error);
    throw new Error(error.message);
  }
}

async function handleSubscriptionDeleted(
  supabase: SupabaseClient,
  sub: Stripe.Subscription,
): Promise<void> {
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      current_period_end: toIsoOrNull(sub.current_period_end),
    })
    .eq("stripe_subscription_id", sub.id);
  if (error) {
    console.error("[stripe-webhook] subscriptions cancel failed:", error);
    throw new Error(error.message);
  }
}

async function handleInvoicePaymentFailed(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice,
): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? null;
  if (!subscriptionId) return;

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId);
  if (error) {
    console.error("[stripe-webhook] past_due update failed:", error);
    throw new Error(error.message);
  }
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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({
      error:
        "STRIPE_TEST_SECRET_KEY / STRIPE_WEBHOOK_SECRET / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY のいずれかが未設定です",
    });
    return;
  }

  const stripe = new Stripe(secretKey);
  const signature = req.headers["stripe-signature"];
  const sig = Array.isArray(signature) ? signature[0] : signature;
  if (!sig) {
    res.status(400).json({ error: "Stripe-Signature ヘッダがありません" });
    return;
  }

  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error("[stripe-webhook] signature verification failed:", err);
    res.status(400).json({ error: `Webhook 署名検証に失敗しました: ${message}` });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          supabase,
          stripe,
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          supabase,
          event.data.object as Stripe.Subscription,
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          supabase,
          event.data.object as Stripe.Subscription,
        );
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          supabase,
          event.data.object as Stripe.Invoice,
        );
        break;
      default:
        // 未対応イベントはログのみ
        console.info(`[stripe-webhook] unhandled event: ${event.type} id=${event.id}`);
    }

    res.status(200).json({ received: true, type: event.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error("[stripe-webhook] handler failed:", err);
    // 500 を返すと Stripe が自動再送する
    res.status(500).json({ error: `イベント処理に失敗しました: ${message}` });
  }
}
