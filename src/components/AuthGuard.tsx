import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext.js";
import { navigate } from "../hooks/useHashRouter.js";
import { hasSupabaseEnv } from "../infra/supabase-client.js";

declare global {
  interface Window {
    __E2E_BYPASS_AUTH__?: boolean;
  }
}

type Props = {
  children: ReactNode;
};

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const ACTIVITY_EVENTS = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"] as const;

export function AuthGuard({ children }: Props) {
  const { session, loading, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowWarning(false);
    timerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, TIMEOUT_MS);
  }, []);

  // E2E test bypass: only effective when explicitly set on window by test runner (localhost only)
  const isE2EBypass = typeof window !== "undefined" && window.__E2E_BYPASS_AUTH__ === true;
  const isActive = !isE2EBypass && hasSupabaseEnv() && !loading && !!session;

  useEffect(() => {
    if (!isActive) return;

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
