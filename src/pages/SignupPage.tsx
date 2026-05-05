import { useState, type FormEvent } from "react";
import { getSupabaseClient, hasSupabaseEnv } from "../infra/supabase-client.js";
import { navigate } from "../hooks/useHashRouter.js";
import { hasLineEnv, startLineLogin } from "../lib/line-oauth.js";

export function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    if (!hasSupabaseEnv()) {
      setError("Supabase が設定されていません");
      return;
    }
    setError(null);
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
      console.error("Failed to start Google signup", err);
      setError("Google 登録に失敗しました。");
    }
  };

  const handleLine = () => {
    if (!hasLineEnv()) {
      setError("LINE ログインが設定されていません。管理者にお問い合わせください。");
      return;
    }
    setError(null);
    try {
      startLineLogin();
    } catch (err) {
      console.error("Failed to start LINE signup", err);
      setError("LINE 登録に失敗しました。");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasSupabaseEnv()) {
      setError("Supabase が設定されていません");
      return;
    }
    if (password.length < 8) {
      setError("パスワードは8文字以上で設定してください");
      return;
    }
    if (password !== passwordConfirm) {
      setError("パスワードが一致しません。もう一度ご確認ください。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const client = await getSupabaseClient();
      const { error: authError } = await client.auth.signUp({
        email,
        password,
        options: { data: { company_name: companyName } },
      });
      if (authError) {
        const msg = authError.message.toLowerCase();
        if (msg.includes("user already registered") || msg.includes("already registered")) {
          setError("このメールアドレスはすでに登録されています。ログインページからサインインしてください。");
        } else if (msg.includes("password") && msg.includes("weak")) {
          setError("パスワードが弱すぎます。英数字・記号を組み合わせた8文字以上を設定してください。");
        } else if (msg.includes("invalid email")) {
          setError("メールアドレスの形式が正しくありません。");
        } else {
          setError("登録に失敗しました。入力内容を確認してもう一度お試しください。");
        }
      } else {
        setSuccess(true);
      }
    } catch (err) {
      console.error("Failed to sign up", err);
      setError("登録に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">登録完了</h2>
          <p className="mt-2 text-sm text-slate-500">
            確認メールを送信しました。メール内のリンクをクリックしてログインしてください。
          </p>
          <button
            onClick={() => navigate("/login")}
            className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            ログインへ
          </button>
        </div>
      </div>
    );
  }

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
          <h1 className="mb-1 text-xl font-bold text-slate-900">14日間 無料トライアル</h1>
          <p className="mb-6 text-sm text-slate-500">クレジットカード不要。今すぐ始める。</p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="company" className="mb-1 block text-sm font-medium text-slate-700">
                会社名
              </label>
              <input
                id="company"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="株式会社◯◯建設"
              />
            </div>
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
                <span className="ml-1 text-xs font-normal text-slate-400">（8文字以上）</span>
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label htmlFor="password-confirm" className="mb-1 block text-sm font-medium text-slate-700">
                パスワード（確認）
              </label>
              <input
                id="password-confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "登録中..." : "無料で始める"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            登録することで
            <button onClick={() => navigate("/legal#tos")} className="mx-0.5 underline hover:text-slate-600">利用規約</button>
            および
            <button onClick={() => navigate("/legal#privacy")} className="mx-0.5 underline hover:text-slate-600">プライバシーポリシー</button>
            に同意したものとみなします。
          </p>

          <div className="my-5 flex items-center gap-3">
            <hr className="flex-1 border-slate-200" />
            <span className="text-xs text-slate-400">またはソーシャルアカウントで登録</span>
            <hr className="flex-1 border-slate-200" />
          </div>

          <button
            type="button"
            onClick={() => { void handleGoogle(); }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google で登録
          </button>

          <button
            type="button"
            onClick={handleLine}
            disabled={!hasLineEnv()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-[#06C755] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#05b34d] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            LINE で登録
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            すでにアカウントをお持ちの方は{" "}
            <button
              onClick={() => navigate("/login")}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              ログイン
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
