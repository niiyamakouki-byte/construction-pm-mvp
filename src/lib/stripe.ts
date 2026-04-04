import { loadStripe, type Stripe } from "@stripe/stripe-js";

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!PUBLISHABLE_KEY) {
    return Promise.resolve(null);
  }
  if (!stripePromise) {
    stripePromise = loadStripe(PUBLISHABLE_KEY);
  }
  return stripePromise;
}

export type PlanId = "free" | "standard" | "pro";

export type StripePlan = {
  id: PlanId;
  label: string;
  priceJpy: number;
  priceLabel: string;
  period: string;
  description: string;
  features: string[];
  highlight: boolean;
  priceId: string | null;
};

export const STRIPE_PLANS: StripePlan[] = [
  {
    id: "free",
    label: "フリー",
    priceJpy: 0,
    priceLabel: "¥0",
    period: "/ 月",
    description: "個人・小規模利用向け無料プラン",
    features: [
      "プロジェクト 1件まで",
      "タスク 20件まで",
      "基本機能利用可能",
      "クレジットカード不要",
    ],
    highlight: false,
    priceId: null,
  },
  {
    id: "standard",
    label: "スタンダード",
    priceJpy: 2980,
    priceLabel: "¥2,980",
    period: "/ 月",
    description: "中小チーム向け全機能プラン",
    features: [
      "プロジェクト 無制限",
      "タスク 無制限",
      "全機能利用可能",
      "メールサポート",
    ],
    highlight: true,
    priceId: import.meta.env.VITE_STRIPE_PRICE_STANDARD as string | undefined ?? null,
  },
  {
    id: "pro",
    label: "プロ",
    priceJpy: 9800,
    priceLabel: "¥9,800",
    period: "/ 月",
    description: "大規模プロジェクト・API連携対応",
    features: [
      "プロジェクト 無制限",
      "タスク 無制限",
      "全機能利用可能",
      "API連携",
      "優先サポート",
    ],
    highlight: false,
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRO as string | undefined ?? null,
  },
];

export function isStripeConfigured(): boolean {
  return typeof PUBLISHABLE_KEY === "string" && PUBLISHABLE_KEY.startsWith("pk_");
}
