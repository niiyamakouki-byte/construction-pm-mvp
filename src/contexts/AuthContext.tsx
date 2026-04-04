import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabaseClient, hasSupabaseEnv } from "../infra/supabase-client.js";
import { navigate } from "../hooks/useHashRouter.js";

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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    getSupabaseClient().then((client) => {
      // Initial session
      client.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      });

      // Listen for auth changes
      const { data } = client.auth.onAuthStateChange((event, newSession) => {
        setSession(newSession);
        setLoading(false);
        // OAuth ログイン後、ランディング/ログインページにいたらアプリへ遷移
        if (event === "SIGNED_IN") {
          const hash = window.location.hash.replace("#", "") || "/";
          if (hash === "/" || hash === "" || hash === "/login" || hash === "/signup") {
            navigate("/app");
          }
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const signOut = async () => {
    if (!hasSupabaseEnv()) return;
    const client = await getSupabaseClient();
    await client.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
