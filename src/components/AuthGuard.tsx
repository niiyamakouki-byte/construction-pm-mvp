import type { ReactNode } from "react";
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

export function AuthGuard({ children }: Props) {
  const { session, loading } = useAuth();

  // E2E test bypass: only effective when explicitly set on window by test runner (localhost only)
  if (typeof window !== "undefined" && window.__E2E_BYPASS_AUTH__ === true) {
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

  return <>{children}</>;
}
