import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabaseClient, hasSupabaseEnv } from "../infra/supabase-client.js";
import { navigate } from "../hooks/useHashRouter.js";
import { appendAuditLog } from "../lib/audit-log.js";
import {
  clearPasswordRecoveryMode,
  markPasswordRecoveryMode,
} from "../lib/password-recovery.js";

type User = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type Session = {
  user: User;
  access_token: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Supabase接続/初期化エラー。表示用にUI側で参照する */
  error: Error | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  error: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Supabase未設定時にローディング解除する初期化パターン
      setLoading(false);
      return;
    }

    let disposed = false;
    let unsubscribe: (() => void) | null = null;

    void getSupabaseClient()
      .then((client) => {
        if (disposed) {
          return;
        }

        void client.auth.getSession().then(({ data }) => {
          if (disposed) {
            return;
          }

          setSession(data.session);
          setLoading(false);
        });

        const { data } = client.auth.onAuthStateChange((event, newSession) => {
          if (disposed) {
            return;
          }

          setSession(newSession);
          setLoading(false);
          if (event === "PASSWORD_RECOVERY") {
            markPasswordRecoveryMode();
            navigate("/account");
            return;
          }
          if (event === "SIGNED_OUT") {
            clearPasswordRecoveryMode();
          }
          // OAuth/メールログイン後、ランディング/ログインページにいたらアプリへ遷移
          // email_confirmed_at が null の場合はメール未確認のため遷移しない
          if (event === "SIGNED_IN" && newSession?.user) {
            const confirmedAt = (newSession.user as { email_confirmed_at?: string | null }).email_confirmed_at;
            if (confirmedAt == null) return;
            appendAuditLog({ type: "login", userId: newSession.user.id, email: newSession.user.email, ts: new Date().toISOString() });
            const hash = window.location.hash.replace("#", "") || "/";
            if (hash === "/" || hash === "" || hash === "/login" || hash === "/signup") {
              navigate("/app");
            }
          }
        });
        if (disposed) {
          data.subscription.unsubscribe();
          return;
        }
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch((err) => {
        console.error("Failed to initialize auth context:", err);
        if (!disposed) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);

  const signOut = async () => {
    if (!hasSupabaseEnv()) return;
    if (session?.user) {
      appendAuditLog({ type: "logout", userId: session.user.id, email: session.user.email, ts: new Date().toISOString() });
    }
    clearPasswordRecoveryMode();
    const client = await getSupabaseClient();
    await client.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, error, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
