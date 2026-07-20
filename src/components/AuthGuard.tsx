import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext.js";
import { navigate } from "../hooks/useHashRouter.js";
import { hasSupabaseEnv } from "../infra/supabase-client.js";
import { appendAuditLog } from "../lib/audit-log.js";

declare global {
  interface Window {
    __E2E_BYPASS_AUTH__?: boolean;
  }
}

type Props = {
  children: ReactNode;
};

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const LOADING_TIMEOUT_MS = 8 * 1000; // 8 seconds — Supabase 接続失敗時に無限スピナーを避ける

const ACTIVITY_EVENTS = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"] as const;

export function AuthGuard({ children }: Props) {
  const { session, loading, error, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      return;
    }
    const id = setTimeout(() => setLoadingTimedOut(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [loading]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowWarning(false);
    timerRef.current = setTimeout(() => {
      setShowWarning(true);
      if (session?.user) {
        appendAuditLog({ type: "timeout", userId: session.user.id, email: session.user.email, ts: new Date().toISOString() });
      }
    }, TIMEOUT_MS);
  }, [session]);

  // E2E test bypass: only effective in dev builds (vite dev / vitest), stripped from production bundles
  const isE2EBypass =
    import.meta.env.DEV && typeof window !== "undefined" && window.__E2E_BYPASS_AUTH__ === true;
  const isActive = !isE2EBypass && hasSupabaseEnv() && !loading && !!session;

  useEffect(() => {
    if (!isActive) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- isActive 変化時にタイマーをリセットする意図的な同期
    resetTimer();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [isActive, resetTimer]);

  const handleContinue = () => {
    resetTimer();
  };

  const handleSignOut = async () => {
    setShowWarning(false);
    await signOut();
  };

  if (isE2EBypass) {
    return <>{children}</>;
  }

  if (!hasSupabaseEnv()) {
    return <>{children}</>;
  }

  if (loading) {
    if (loadingTimedOut || error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm" role="alert">
            <p className="text-base font-bold text-slate-900">接続できません</p>
            <p className="mt-2 text-sm text-slate-600">
              {error
                ? "サーバーへの接続でエラーが発生しました。ネットワークを確認するか、ログインページからやり直してください。"
                : "サーバーへの接続に時間がかかっています。ネットワークを確認するか、ログインページからやり直してください。"}
            </p>
            {error ? (
              <p className="mt-2 break-all text-xs text-slate-400">{error.message}</p>
            ) : null}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              ログインページへ
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-sm text-slate-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    navigate("/login");
    return null;
  }

  return (
    <>
      {children}
      {showWarning ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-timeout-title"
        >
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2
              id="session-timeout-title"
              className="mb-2 text-base font-bold text-slate-900"
            >
              セッションが切れそうです
            </h2>
            <p className="mb-5 text-sm text-slate-600">
              継続しますか？
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleContinue}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                継続
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
