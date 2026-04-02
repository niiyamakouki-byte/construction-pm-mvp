import { useSubscription, type Plan } from "../hooks/useSubscription.js";
import { navigate } from "../hooks/useHashRouter.js";

type PlanCard = {
  plan: Plan;
  label: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlight: boolean;
};

const PLAN_CARDS: PlanCard[] = [
  {
    plan: "trial",
    label: "トライアル",
    price: "無料",
    period: "14日間",
    description: "機能をすべて試せるトライアルプラン",
    features: ["プロジェクト 3件まで", "ユーザー 2名まで", "全機能利用可能", "クレジットカード不要"],
    highlight: false,
  },
  {
    plan: "basic",
    label: "ベーシック",
    price: "¥9,800",
    period: "/ 月",
    description: "小規模チーム向けスタンダードプラン",
    features: ["プロジェクト 10件まで", "ユーザー 5名まで", "全機能利用可能", "メールサポート"],
    highlight: false,
  },
  {
    plan: "pro",
    label: "プロ",
    price: "¥29,800",
    period: "/ 月",
    description: "大規模プロジェクト・無制限利用",
    features: ["プロジェクト 無制限", "ユーザー 無制限", "全機能利用可能", "優先サポート", "カスタム統合"],
    highlight: true,
  },
];

function PlanCardView({
  card,
  isCurrent,
}: {
  card: PlanCard;
  isCurrent: boolean;
}) {
  const handleUpgrade = () => {
    // Stripe checkout integration placeholder
    alert(`プランのアップグレード機能は準備中です。\nお問い合わせ: support@genbahub.com`);
  };

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
        card.highlight
          ? "border-brand-500 bg-brand-50 shadow-brand-100"
          : "border-slate-200 bg-white"
      }`}
    >
      {card.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">
          おすすめ
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">{card.label}</h3>
        <p className="mt-1 text-sm text-slate-500">{card.description}</p>
      </div>

      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-slate-900">{card.price}</span>
        <span className="text-sm text-slate-500">{card.period}</span>
      </div>

      <ul className="mb-8 flex-1 space-y-2">
        {card.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm text-slate-700">
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
            {feature}
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div className="rounded-lg bg-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-slate-500">
          現在のプラン
        </div>
      ) : card.plan === "trial" ? null : (
        <button
          type="button"
          onClick={handleUpgrade}
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${
            card.highlight
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "border border-brand-500 text-brand-600 hover:bg-brand-50"
          }`}
        >
          このプランに変更
        </button>
      )}
    </div>
  );
}

export function PricingPage() {
  const { plan: currentPlan } = useSubscription();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">プランと料金</h1>
        <p className="mt-2 text-slate-500">
          現在のプラン:{" "}
          <span className="font-semibold text-brand-600">
            {PLAN_CARDS.find((c) => c.plan === currentPlan)?.label ?? currentPlan}
          </span>
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {PLAN_CARDS.map((card) => (
          <PlanCardView key={card.plan} card={card} isCurrent={card.plan === currentPlan} />
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-slate-400">
        プランのアップグレードは Stripe 決済で処理されます（準備中）。
        ご質問は{" "}
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
