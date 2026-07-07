/**
 * PushNotificationCard — 通知の許可フロー + テスト送信（Web Push 基盤の実証UI）。
 * AccountSettingsPage に差し込む単体カード。
 */
import { useEffect, useState } from "react";
import {
  enablePush,
  getExistingSubscription,
  getPermission,
  isPushSupported,
  sendTestPush,
} from "../lib/push.js";

type Status = { kind: "idle" | "working" | "ok" | "error"; message?: string };

export function PushNotificationCard() {
  const [supported] = useState(isPushSupported());
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState(getPermission());
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    let active = true;
    void getExistingSubscription().then((sub) => {
      if (active) setSubscribed(Boolean(sub));
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleEnable() {
    setStatus({ kind: "working" });
    try {
      await enablePush();
      setSubscribed(true);
      setPermission(getPermission());
      setStatus({ kind: "ok", message: "通知を有効にしました。" });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "失敗しました。" });
    }
  }

  async function handleTest() {
    setStatus({ kind: "working" });
    try {
      const { sent } = await sendTestPush();
      setStatus({
        kind: sent > 0 ? "ok" : "error",
        message: sent > 0 ? `テスト通知を送信しました（${sent}件）。` : "送信先が見つかりませんでした。",
      });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "失敗しました。" });
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-base font-semibold text-slate-800">プッシュ通知</h2>
      <p className="mb-4 text-sm text-slate-500">
        現場の更新をアプリからお知らせします。まず通知を有効化し、テスト送信で受信を確認できます。
      </p>

      {!supported ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500" role="status">
          この端末/ブラウザはプッシュ通知に対応していません。
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                subscribed
                  ? "bg-brand-100 text-brand-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {subscribed ? "有効" : permission === "denied" ? "ブロック中" : "未設定"}
            </span>

            {!subscribed && (
              <button
                type="button"
                onClick={handleEnable}
                disabled={status.kind === "working" || permission === "denied"}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
              >
                通知を有効にする
              </button>
            )}

            {subscribed && (
              <button
                type="button"
                onClick={handleTest}
                disabled={status.kind === "working"}
                className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                テスト通知を送信
              </button>
            )}
          </div>

          {permission === "denied" && (
            <p className="mt-3 text-sm text-slate-500">
              通知がブロックされています。ブラウザのサイト設定から許可してください。
            </p>
          )}

          {status.message && (
            <p
              className={`mt-3 text-sm ${
                status.kind === "error" ? "text-red-700" : "text-brand-700"
              }`}
              role={status.kind === "error" ? "alert" : "status"}
            >
              {status.message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
