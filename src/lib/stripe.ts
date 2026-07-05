import { loadStripe, type Stripe } from "@stripe/stripe-js";

// TEST MODE を優先。本番 key（VITE_STRIPE_PUBLISHABLE_KEY）はフォールバックとして残す。
const PUBLISHABLE_KEY =
  (import.meta.env.VITE_STRIPE_TEST_PUBLIC_KEY as string | undefined) ??
  (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined);

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
    priceJpy: 20000,
    priceLabel: "¥20,000",
    period: "/ 月",
    description: "日々の現場管理に必要な機能をひとまとめに",
    features: [
      "工程表（ガント）作成・共有",
      "原価管理（予算超過アラート）",
      "CRM（見込み客・追客管理）",
      "QR現場入場（入退場記録）",
      "写真AI（現場写真の自動分類・進捗記録）",
      "案件・タスク 無制限",
    ],
    highlight: true,
    priceId: import.meta.env.VITE_STRIPE_PRICE_STANDARD as string | undefined ?? null,
  },
  {
    id: "pro",
    label: "プロ",
    priceJpy: 30000,
    priceLabel: "¥30,000",
    period: "/ 月",
    description: "会計連携・図面管理までまとめて任せたいチーム向け",
    features: [
      "スタンダードの全機能",
      "図面差分チェック（AIによる変更点自動検出）",
      "freee会計連携・入金照合",
      "案件・タスク 無制限",
      "優先サポート",
    ],
    highlight: false,
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRO as string | undefined ?? null,
  },
];

export function isStripeConfigured(): boolean {
  return typeof PUBLISHABLE_KEY === "string" && PUBLISHABLE_KEY.startsWith("pk_");
}
