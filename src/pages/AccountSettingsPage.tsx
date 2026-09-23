/**
 * AccountSettingsPage — アカウント設定（プロフィール・パスワード変更）
 * SaaS必須ページ (P1)
 */

import { useEffect, useState, type FormEvent } from "react";
import { useAuth, readGoogleProviderToken } from "../contexts/AuthContext.js";
import { getSupabaseClient, hasSupabaseEnv, type AuthIdentity } from "../infra/supabase-client.js";
import { linkProvider, loadLinkedIdentities, providerLabel, unlinkProvider } from "../lib/account-linking.js";
import { startGoogleOAuth } from "../lib/google-sign-in.js";
import { registerDevicePasskey } from "../lib/passkey-auth.js";
import {
  clearPasswordRecoveryMode,
  isPasswordRecoveryMode,
} from "../lib/password-recovery.js";
import { PushNotificationCard } from "../components/PushNotificationCard.js";
import {
  TAX_ROUNDING_LABELS,
  readTaxRoundingMode,
  writeTaxRoundingMode,
  type TaxRoundingMode,
} from "../lib/tax-rounding.js";

export function AccountSettingsPage() {
  const { user } = useAuth();

  // Googleカレンダー連携
  const [googleConnected, setGoogleConnected] = useState(() => readGoogleProviderToken() !== null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [identities, setIdentities] = useState<AuthIdentity[]>([]);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    let cancelled = false;
    void (async () => {
      try {
        const client = await getSupabaseClient();
        if (!client?.auth?.getUserIdentities) return;
        const loaded = await loadLinkedIdentities(client.auth);
        if (cancelled) return;
        setIdentities(loaded.identities);
        if (loaded.errorMessage) setLinkError(loaded.errorMessage);
      } catch {
        // 未ログインのテストや未対応クライアントでは空のままにする
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnectGoogleCalendar = async () => {
    if (!hasSupabaseEnv()) {
      setGoogleError("Supabase が設定されていません");
      return;
    }
    setGoogleError(null);
    try {
      const client = await getSupabaseClient();
      const { errorMessage } = await startGoogleOAuth(client.auth, { postAuthRoute: "/account" });
      if (errorMessage) {
        setGoogleError(errorMessage);
        return;
      }
      // OAuth リダイレクトで遷移するためここには通常戻ってこない
      setGoogleConnected(readGoogleProviderToken() !== null);
    } catch {
      setGoogleError("Googleカレンダー連携に失敗しました");
    }
  };

  // パスワード変更
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(() => isPasswordRecoveryMode());
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [taxRounding, setTaxRounding] = useState<TaxRoundingMode>(() => readTaxRoundingMode());

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasSupabaseEnv()) {
      setPwError("Supabase が設定されていません");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("新しいパスワードは8文字以上で設定してください");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPwError("新しいパスワードが一致しません");
      return;
    }
    setPwLoading(true);
    setPwError(null);
    setPwSuccess(null);
    try {
      const client = await getSupabaseClient();
      // まず現在のパスワードで再認証
      if (!recoveryMode && user?.email) {
        const { error: signInError } = await client.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (signInError) {
          setPwError("現在のパスワードが正しくありません");
          return;
        }
      }
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        setPwError("パスワードの変更に失敗しました。もう一度お試しください。");
      } else {
        clearPasswordRecoveryMode();
        setRecoveryMode(false);
        setPwSuccess(recoveryMode ? "新しいパスワードを設定しました" : "パスワードを変更しました");
        setCurrentPassword("");
        setNewPassword("");
        setNewPasswordConfirm("");
      }
    } catch {
      setPwError("パスワードの変更に失敗しました。もう一度お試しください。");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-slate-900">アカウント設定</h1>

      {/* プロフィール情報 */}
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-800">プロフィール</h2>
        <div className="space-y-3">
          <div>
            <span className="text-sm font-medium text-slate-500">メールアドレス</span>
            <p className="mt-0.5 text-sm text-slate-900">{user?.email ?? "未設定"}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-500">ユーザーID</span>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{user?.id ?? "—"}</p>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-slate-800">ログイン方法</h2>
        <p className="mb-4 text-sm text-slate-500">
          同じメールアドレスの Google と Apple を、このアカウントに追加できます。最後の方法は外せません。
        </p>
        {identities.length > 0 ? (
          <ul className="mb-4 space-y-2">
            {identities.map((identity) => (
              <li key={identity.identity_id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-800">{providerLabel(identity.provider)}</span>
                <button
                  type="button"
                  disabled={identities.length < 2}
                  onClick={() => {
                    void (async () => {
                      const client = await getSupabaseClient();
                      const result = await unlinkProvider(client.auth, identity, identities);
                      if (result.errorMessage) {
                        setLinkError(result.errorMessage);
                        return;
                      }
                      setIdentities((current) => current.filter((item) => item.identity_id !== identity.identity_id));
                      setLinkMessage("連携を解除しました。");
                    })();
                  }}
                  className="text-xs text-slate-500 underline disabled:no-underline disabled:opacity-40"
                >
                  解除
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-slate-500">ログイン中の方法は、設定を有効にしたあとに表示されます。</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void (async () => {
                setLinkError(null);
                const client = await getSupabaseClient();
                const result = await linkProvider(client.auth, "google");
                if (result.errorMessage) setLinkError(result.errorMessage);
              })();
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Google を連携
          </button>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                setLinkError(null);
                const client = await getSupabaseClient();
                const result = await linkProvider(client.auth, "apple");
                if (result.errorMessage) setLinkError(result.errorMessage);
              })();
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Apple を連携
          </button>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                setLinkError(null);
                const client = await getSupabaseClient();
                const result = await registerDevicePasskey(client.auth);
                if (result.errorMessage) setLinkError(result.errorMessage);
                else setLinkMessage(result.friendlyName ? `${result.friendlyName} を登録しました。` : "この端末のパスキーを登録しました。");
              })();
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            パスキーを登録
          </button>
        </div>
        {linkError ? <p className="mt-3 text-sm text-red-700" role="alert">{linkError}</p> : null}
        {linkMessage ? <p className="mt-3 text-sm text-brand-700" role="status">{linkMessage}</p> : null}
      </section>

      {/* Googleカレンダー連携 */}
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-slate-800">Googleカレンダー連携</h2>
        <p className="mb-4 text-sm text-slate-500">
          連携すると、工程表に個人予定とのダブりが表示されます。読み取り専用で予定の追加・削除はしません。
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              googleConnected
                ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {googleConnected ? "連携済み" : "未連携"}
          </span>
          <button
            type="button"
            onClick={() => { void handleConnectGoogleCalendar(); }}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {googleConnected ? "再連携" : "Googleカレンダーを連携"}
          </button>
        </div>
        {googleError && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {googleError}
          </p>
        )}
      </section>

      {/* プッシュ通知 */}
      <PushNotificationCard />

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-slate-800">見積の消費税端数</h2>
        <p className="mb-4 text-sm text-slate-500">新しく作る見積の消費税1円未満を処理します。既定は切捨てです。</p>
        <label htmlFor="tax-rounding" className="mb-1 block text-sm font-medium text-slate-700">
          丸め方式
        </label>
        <select
          id="tax-rounding"
          value={taxRounding}
          onChange={(event) => {
            const mode = event.target.value as TaxRoundingMode;
            setTaxRounding(mode);
            writeTaxRoundingMode(mode);
          }}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {Object.entries(TAX_ROUNDING_LABELS).map(([mode, label]) => (
            <option key={mode} value={mode}>{label}</option>
          ))}
        </select>
      </section>

      {/* パスワード変更 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-800">パスワード変更</h2>

        {recoveryMode && (
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
            パスワード再設定モードです。新しいパスワードを設定してください。
          </div>
        )}

        {pwError && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {pwError}
          </div>
        )}
        {pwSuccess && (
          <div className="mb-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700" role="status">
            {pwSuccess}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          {!recoveryMode && (
            <div>
              <label htmlFor="current-password" className="mb-1 block text-sm font-medium text-slate-700">
                現在のパスワード
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="••••••••"
              />
            </div>
          )}
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-700">
              新しいパスワード
              <span className="ml-1 text-xs font-normal text-slate-400">（8文字以上）</span>
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showNewPassword ? "パスワードを隠す" : "パスワードを表示"}
              >
                {showNewPassword ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="new-password-confirm" className="mb-1 block text-sm font-medium text-slate-700">
              新しいパスワード（確認）
            </label>
            <input
              id="new-password-confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={pwLoading}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          >
            {pwLoading ? "変更中..." : "パスワードを変更"}
          </button>
        </form>
      </section>
    </div>
  );
}
