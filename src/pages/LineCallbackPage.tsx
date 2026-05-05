import { useEffect, useState } from "react";
import { exchangeLineCode, validateLineState } from "../lib/line-oauth.js";
import { getSupabaseClient, hasSupabaseEnv } from "../infra/supabase-client.js";
import { navigate } from "../hooks/useHashRouter.js";

/**
 * LINE OAuth callback ページ
 * ルート: /auth/line/callback
 * LINE から返ってきた code + state を検証し、Supabase signInWithIdToken を呼ぶ
 */
export function LineCallbackPage() {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const errorParam = params.get("error");

      if (errorParam) {
        setErrorMessage(`LINE 認証がキャンセルされました: ${errorParam}`);
        setStatus("error");
        return;
      }

      if (!code || !state) {
        setErrorMessage("LINE から受け取ったパラメータが不正です。");
        setStatus("error");
        return;
      }

      if (!validateLineState(state)) {
        setErrorMessage("セキュリティ検証に失敗しました。もう一度お試しください。");
        setStatus("error");
        return;
      }

      if (!hasSupabaseEnv()) {
        setErrorMessage("Supabase が設定されていません。");
        setStatus("error");
        return;
      }

      try {
        const tokens = await exchangeLineCode(code);
        const client = await getSupabaseClient();
        const { error: authError } = await (client.auth as unknown as {
          signInWithIdToken(options: {
            provider: string;
            token: string;
          }): Promise<{ error: { message: string } | null }>;
        }).signInWithIdToken({
          provider: "line",
          token: tokens.id_token,
        });

        if (authError) {
          setErrorMessage(`ログインに失敗しました: ${authError.message}`);
          setStatus("error");
          return;
        }

        navigate("/app");
      } catch (err) {
        console.error("LINE callback error", err);
        setErrorMessage(err instanceof Error ? err.message : "LINE ログインに失敗しました。");
        setStatus("error");
      }
    })();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900">
        <div className="text-center text-white">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          <p className="text-sm font-medium">LINE ログイン処理中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg className="h-7 w-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900">ログインに失敗しました</h2>
        {errorMessage && (
          <p className="mt-2 text-sm text-slate-500">{errorMessage}</p>
        )}
        <button
          onClick={() => navigate("/login")}
          className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          ログインページへ戻る
        </button>
      </div>
    </div>
  );
}
