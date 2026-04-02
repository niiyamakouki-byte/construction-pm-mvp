import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext.js";
import { navigate } from "../hooks/useHashRouter.js";

type Props = {
  children: ReactNode;
};

export function AuthGuard({ children }: Props) {
  const { session, loading } = useAuth();

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
