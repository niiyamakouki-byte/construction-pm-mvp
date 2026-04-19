import { useState } from "react";
import { navigate } from "../hooks/useHashRouter.js";
import { useSubscriptionContext } from "../contexts/SubscriptionContext.js";
import { useAuth } from "../contexts/AuthContext.js";
import {
  STRIPE_PLANS,
  isStripeConfigured,
  type PlanId,
  type StripePlan,
} from "../lib/stripe.js";

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-brand-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function StripeNotReadyModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stripe-modal-title"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2
          id="stripe-modal-title"
          className="text-lg font-bold text-slate-900"
        >
          Stripe連携準備中
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          現在、Stripe決済の設定を準備中です。
          <br />
          サービスリリース後にご利用いただけるようになります。
        </p>
        <p className="mt-3 text-sm text-slate-500">
          ご質問は{" "}
          <a
            href="mailto:support@genbahub.com"
            className="text-brand-600 hover:underline"
          >
            support@genbahub.com
          </a>{" "}
          までお問い合わせください。
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

function PlanCardView({
  plan,
  currentPlan,
  onSelect,
  loading,
}: {
  plan: StripePlan;
  currentPlan: PlanId;
  onSelect: (plan: StripePlan) => void;
  loading: boolean;
}) {
  const isCurrent = plan.id === currentPlan;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
        plan.highlight
          ? "border-brand-500 bg-brand-50 shadow-brand-100"
          : "border-slate-200 bg-white"
      }`}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">
          おすすめ
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">{plan.label}</h3>
        <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
      </div>

      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-slate-900">
          {plan.priceLabel}
        </span>
        <span className="text-sm text-slate-500">{plan.period}</span>
      </div>

      <ul className="mb-8 flex-1 space-y-2">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-center gap-2 text-sm text-slate-700"
          >
            <CheckIcon />
            {feature}
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div className="rounded-lg bg-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-slate-500">
          現在のプラン
        </div>
      ) : plan.id === "free" ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-xs font-semibold text-slate-400">
          無料でご利用いただけます
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(plan)}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "処理中..." : `${plan.label}プランを選択`}
        </button>
      )}
    </div>
  );
}

export function PricingPage() {
  const { plan: currentPlan } = useSubscriptionContext();
  const { session } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPlan = async (selected: StripePlan) => {
    setError(null);

    // 公開鍵・Price ID が未設定なら情報モーダルを表示。
    // これにより環境変数未設定のプレビュー/ローカルでも UI は壊れない。
    if (!isStripeConfigured() || !selected.priceId) {
      setShowModal(true);
      return;
    }

    if (!session?.access_token) {
      setError("ログインが必要です。ログインしてから再度お試しください。");
      return;
    }

    // サーバーサイド関数で Checkout Session を作成し、返ってきた URL に遷移する。
    // priceId はサーバー側で env から解決するため、ここからは送らない。
    setCheckoutLoading(true);
    try {
      const response = await fetch("/api/checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plan: selected.id,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          body?.error ?? `決済セッション作成に失敗しました (HTTP ${response.status})`,
        );
      }

      const { url } = (await response.json()) as {
        url?: string;
      };

      if (!url) {
        throw new Error("セッション URL が取得できませんでした");
      }
      window.location.href = url;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "決済処理でエラーが発生しました";
      setError(`${message}。もう一度お試しください。`);
      console.error("Stripe checkout error:", err);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const currentPlanLabel =
    STRIPE_PLANS.find((p) => p.id === currentPlan)?.label ?? currentPlan;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {showModal && <StripeNotReadyModal onClose={() => setShowModal(false)} />}

      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">プランと料金</h1>
        <p className="mt-2 text-slate-500">
          現在のプラン:{" "}
          <span className="font-semibold text-brand-600">{currentPlanLabel}</span>
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-3">
        {STRIPE_PLANS.map((plan) => (
          <PlanCardView
            key={plan.id}
            plan={plan}
            currentPlan={currentPlan}
            onSelect={handleSelectPlan}
            loading={checkoutLoading}
          />
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-slate-400">
        プランのアップグレードは Stripe 決済で処理されます。ご質問は{" "}
        <a
          href="mailto:support@genbahub.com"
          className="text-brand-600 hover:underline"
        >
          support@genbahub.com
        </a>{" "}
        までお問い合わせください。
      </p>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => navigate("/app")}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          アプリに戻る
        </button>
      </div>
    </div>
  );
}
