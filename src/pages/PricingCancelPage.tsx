/**
 * Stripe Checkout でキャンセルまたはブラウザバックされた場合に表示されるページ。
 */
import { navigate } from "../hooks/useHashRouter.js";

export function PricingCancelPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M4.93 4.93l14.14 14.14"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-amber-900">
          お支払いはキャンセルされました
        </h1>
        <p className="mt-2 text-sm text-amber-800">
          料金は発生していません。プラン選択ページへ戻ってやり直すか、
          そのままアプリをご利用いただけます。
        </p>
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/pricing")}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          プラン選択に戻る
        </button>
        <button
          type="button"
          onClick={() => navigate("/app")}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          アプリに戻る
        </button>
      </div>
    </div>
  );
}
