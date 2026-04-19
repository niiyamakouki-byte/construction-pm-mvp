/**
 * Vercel Serverless Function: POST /api/stripe-webhook
 *
 * Stripe からのイベントを受けて public.subscriptions を更新する想定のスタブ。
 * 現時点では署名検証と TODO のみ実装。実際の DB 更新はデプロイ後の URL が確定
 * してから Stripe ダッシュボードで Endpoint を登録し、secret を発行してから
 * 実装を埋める。
 *
 * 必要な環境変数:
 *   - STRIPE_TEST_SECRET_KEY
 *   - STRIPE_WEBHOOK_SECRET  (Stripe ダッシュボードから発行)
 *   - SUPABASE_SERVICE_ROLE_KEY  (DB 更新に必要。Vercel 側で暗号化)
 *
 * Vercel では Raw body を取得するために bodyParser を無効化する必要がある。
 * 下の config を参照。
 */
import Stripe from "stripe";

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
  if (!secretKey || !webhookSecret) {
    res.status(500).json({
      error:
        "STRIPE_TEST_SECRET_KEY または STRIPE_WEBHOOK_SECRET が未設定です",
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

  // TODO: デプロイ後に Stripe ダッシュボードで Webhook endpoint を登録し、
  //        以下のイベントで public.subscriptions を更新する実装を入れる。
  //   - checkout.session.completed   → subscriptions 行を作成/更新 (status='active')
  //   - customer.subscription.updated → plan / current_period_end を更新
  //   - customer.subscription.deleted → status='canceled' に更新
  //   - invoice.payment_failed        → status='past_due' に更新
  //
  // 現段階では受領のみ。ログして 200 OK を返すスタブ。
  console.info(`[stripe-webhook] received event: ${event.type} id=${event.id}`);

  res.status(200).json({ received: true, type: event.type });
}
