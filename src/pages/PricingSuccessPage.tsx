/**
 * Stripe Checkout 成功後に表示されるページ。
 * URL のクエリ (session_id) は情報として表示するだけで、
 * 実際のサブスクリプション状態は Webhook により反映される。
 */
import { useEffect, useMemo, useState } from "react";
import { navigate } from "../hooks/useHashRouter.js";

function parseSessionIdFromHash(): string | null {
  // ハッシュルーターなので location.hash = "#/pricing/success?session_id=cs_test_xxx"
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const queryIndex = hash.indexOf("?");
  if (queryIndex === -1) return null;
  const query = hash.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  return params.get("session_id");
}

export function PricingSuccessPage() {
  const sessionId = useMemo(() => parseSessionIdFromHash(), []);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (countdown <= 0) {
      navigate("/app");
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white">
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
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-brand-900">
          お申し込みありがとうございます
        </h1>
        <p className="mt-2 text-sm text-brand-800">
          Stripe でのお支払い手続きが完了しました。
          <br />
          プランの反映まで数秒かかる場合があります。
        </p>
        {sessionId && (
          <p className="mt-3 text-xs text-brand-700">
            セッション ID:{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">
              {sessionId}
            </code>
          </p>
        )}
        <p className="mt-4 text-xs text-brand-700">
          {countdown} 秒後にアプリへ戻ります…
        </p>
      </div>
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => navigate("/app")}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          今すぐアプリへ戻る
        </button>
      </div>
    </div>
  );
}
