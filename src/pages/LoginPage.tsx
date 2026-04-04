import { useState, type FormEvent } from "react";
import { getSupabaseClient, hasSupabaseEnv } from "../infra/supabase-client.js";
import { navigate } from "../hooks/useHashRouter.js";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasSupabaseEnv()) {
      setError("Supabase が設定されていません");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const client = await getSupabaseClient();
      const { error: authError } = await client.auth.signInWithPassword({ email, password });
      if (authError) {
        if (authError.message.toLowerCase().includes("email not confirmed")) {
          setError("メールアドレスが確認されていません。確認メールのリンクをクリックしてからログインしてください。");
        } else {
          setError(authError.message);
        }
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error("Failed to log in with email and password", err);
      setError("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!hasSupabaseEnv()) {
      setError("Supabase が設定されていません");
      return;
    }
    try {
      const client = await getSupabaseClient();
      const redirectTo =
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
          ? window.location.origin
          : "https://construction-pm-mvp.vercel.app";
      await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
    } catch (err) {
      console.error("Failed to start Google login", err);
      setError("Google ログインに失敗しました。");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <button
            onClick={() => navigate("/")}
            className="inline-flex flex-col items-center gap-1 hover:opacity-90"
          >
            <span className="text-3xl font-bold text-white tracking-tight">GenbaHub</span>
            <span className="text-sm text-brand-300">現場ハブ — 建設プロジェクト管理</span>
          </button>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="mb-6 text-xl font-bold text-slate-900">ログイン</h1>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <hr className="flex-1 border-slate-200" />
            <span className="text-xs text-slate-400">または</span>
            <hr className="flex-1 border-slate-200" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google でログイン
          </button>

          <p className="mt-6 text-center text-sm text-slate-500">
            アカウントをお持ちでない方は{" "}
            <button
              onClick={() => navigate("/signup")}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              新規登録
            </button>
          </p>

          <p className="mt-2 text-center text-sm text-slate-500">
            <button
              onClick={() => navigate("/")}
              className="font-medium text-slate-400 hover:text-slate-600"
            >
              ランディングページへ
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
