/**
 * Stripe Checkout Session 作成のサーバーサイドロジック。
 *
 * Vercel Serverless Function（/api/checkout-session.ts）から呼び出される
 * テスタブルなコア。Stripe SDK は依存性注入可能にしておき、
 * ユニットテストではモックを渡せるようにする。
 *
 * 現時点では TEST MODE 専用。STRIPE_TEST_SECRET_KEY が未設定の場合は
 * 呼び出し元で設定エラーを返す想定。
 *
 * セキュリティ方針:
 *   priceId はクライアントから受け取らず、ここに来るまでにサーバー側で
 *   plan → priceId のマッピングが解決済みである必要がある。
 */

export type CheckoutPlanId = "standard" | "pro";

export type CreateCheckoutSessionInput = {
  plan: CheckoutPlanId;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  clientReferenceId?: string;
};

export type CreateCheckoutSessionResult = {
  sessionId: string;
  url: string;
};

/**
 * Stripe SDK の `checkout.sessions.create` と同じ形のメソッドを持つ最小インターフェース。
 * ユニットテストでモックを差し込むためにこの形で受け取る。
 */
export type StripeCheckoutSessionsAPI = {
  create: (params: Record<string, unknown>) => Promise<{
    id: string;
    url: string | null;
  }>;
};

/**
 * Checkout Session を作成する。
 * URL が Stripe から返らない場合はエラー。
 */
export async function createCheckoutSession(
  stripeCheckout: StripeCheckoutSessionsAPI,
  input: CreateCheckoutSessionInput,
): Promise<CreateCheckoutSessionResult> {
  if (!input.priceId) {
    throw new Error("priceId が指定されていません");
  }
  if (input.plan !== "standard" && input.plan !== "pro") {
    throw new Error(`未対応のプランです: ${String(input.plan)}`);
  }

  const session = await stripeCheckout.create({
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    ...(input.clientReferenceId ? { client_reference_id: input.clientReferenceId } : {}),
    metadata: {
      plan: input.plan,
    },
  });

  if (!session.url) {
    throw new Error("Stripe からセッション URL が返されませんでした");
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}
