import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseClient, hasSupabaseEnv } from "../infra/supabase-client.js";
import { navigate } from "../hooks/useHashRouter.js";
import { trackEvent } from "../lib/analytics.js";
import { trackFunnelStep } from "../lib/signup-funnel.js";

export function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const abandonedRef = useRef(false);
  const draftRef = useRef({
    companyName: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });

  const trackSignupStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent("signup_started", { source: "signup_page" });
    trackFunnelStep("signup_started");
  };

  const trackSignupAbandoned = () => {
    if (!startedRef.current || completedRef.current || abandonedRef.current) return;
    abandonedRef.current = true;
    trackEvent("signup_abandoned", {
      source: "signup_page",
      has_company: draftRef.current.companyName.trim().length > 0,
      has_email: draftRef.current.email.trim().length > 0,
      has_password: draftRef.current.password.length > 0,
      has_password_confirm: draftRef.current.passwordConfirm.length > 0,
    });
  };

  useEffect(() => {
    const onPageHide = () => trackSignupAbandoned();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") trackSignupAbandoned();
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      trackSignupAbandoned();
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    trackSignupStarted();
    const normalizedEmail = email.trim();
    const normalizedCompanyName = companyName.trim();
    if (!hasSupabaseEnv()) {
      setError("Supabase が設定されていません");
      return;
    }
    if (!normalizedCompanyName) {
      setError("会社名を入力してください");
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
    trackEvent("signup_submit", { source: "signup_page" });
    try {
      const client = await getSupabaseClient();
      const { error: authError } = await client.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { company_name: normalizedCompanyName } },
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
        completedRef.current = true;
        trackEvent("signup_completed", { source: "signup_page" });
        trackFunnelStep("signup_completed");
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
          <h2 className="text-xl font-bold text-slate-900">登録完了！</h2>
          <p className="mt-2 text-sm text-slate-500">
            確認メールを送信しました。メール内のリンクをクリックしてログインしてください。
          </p>
          <div className="mt-5 rounded-xl bg-brand-50 px-4 py-4 text-left">
            <p className="text-xs font-semibold text-brand-700 mb-2">ログイン後すぐにできること</p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand-500">✓</span>
                内装工程テンプレ（LGS・ボード・仕上など）を即適用
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand-500">✓</span>
                PDF見積をアップロードして自動積算
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand-500">✓</span>
                現場写真をスマホで撮って日報に自動反映
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand-500">✓</span>
                サンプルプロジェクトで機能を体験
              </li>
            </ul>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            ログインして始める
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
                onChange={(e) => {
                  trackSignupStarted();
                  const nextValue = e.target.value;
                  draftRef.current.companyName = nextValue;
                  setCompanyName(nextValue);
                }}
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
                onChange={(e) => {
                  trackSignupStarted();
                  const nextValue = e.target.value;
                  draftRef.current.email = nextValue;
                  setEmail(nextValue);
                }}
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
                onChange={(e) => {
                  trackSignupStarted();
                  const nextValue = e.target.value;
                  draftRef.current.password = nextValue;
                  setPassword(nextValue);
                }}
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
                onChange={(e) => {
                  trackSignupStarted();
                  const nextValue = e.target.value;
                  draftRef.current.passwordConfirm = nextValue;
                  setPasswordConfirm(nextValue);
                }}
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
