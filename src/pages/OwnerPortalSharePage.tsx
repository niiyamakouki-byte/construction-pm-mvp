/**
 * OwnerPortalSharePage — share-token 認証ゲート (Sprint 66)
 * URL: /#/portal/share/:token
 *
 * フロー:
 *   1. URL の :token を verifySignedToken で検証
 *   2. パスワード要求 → 入力フォーム
 *   3. 期限切れ → 期限切れメッセージ
 *   4. 改ざん → エラーメッセージ
 *   5. 認証成功 → OwnerAppPage にリダイレクト
 */

import { useEffect, useState } from "react";
import { verifySignedToken } from "../lib/share-token.js";

type State =
  | { phase: "loading" }
  | { phase: "needs_password"; projectId: string }
  | { phase: "expired" }
  | { phase: "tampered" }
  | { phase: "error"; message: string }
  | { phase: "authed"; projectId: string };

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-400">確認中...</p>
    </div>
  );
}

function ExpiredScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 text-4xl">⏰</div>
        <h1 className="mb-2 text-lg font-bold text-slate-800">リンクの有効期限が切れました</h1>
        <p className="text-sm text-slate-500">
          担当者に新しい共有リンクを発行してもらってください。
        </p>
      </div>
    </div>
  );
}

function TamperedScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 text-4xl">⚠️</div>
        <h1 className="mb-2 text-lg font-bold text-red-700">無効なリンクです</h1>
        <p className="text-sm text-slate-500">
          URLが正しくありません。担当者にご確認ください。
        </p>
      </div>
    </div>
  );
}

function PasswordForm({
  projectId,
  rawToken,
  onSuccess,
}: {
  projectId: string;
  rawToken: string;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError("");
    const result = await verifySignedToken(rawToken, password);
    setChecking(false);
    if (result.valid) {
      onSuccess();
    } else if (result.expired) {
      setError("リンクの有効期限が切れています。");
    } else {
      setError("パスワードが正しくありません。");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-lg font-bold text-slate-800">パスワードを入力</h1>
        <p className="mb-6 text-xs text-slate-400">
          案件ID: <span className="font-mono">{projectId}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            required
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#6B8E5A] focus:ring-2 focus:ring-[#6B8E5A]/20"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={checking}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: "#6B8E5A" }}
          >
            {checking ? "確認中..." : "アクセスする"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function OwnerPortalSharePage({ token }: { token: string }) {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const result = await verifySignedToken(token);
      if (cancelled) return;

      if (result.tampered) {
        setState({ phase: "tampered" });
      } else if (result.expired) {
        setState({ phase: "expired" });
      } else if (result.requiresPassword && result.projectId) {
        setState({ phase: "needs_password", projectId: result.projectId });
      } else if (result.valid && result.projectId) {
        setState({ phase: "authed", projectId: result.projectId });
      } else {
        setState({ phase: "tampered" });
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function handlePasswordSuccess() {
    // Re-verify would re-prompt; since we already have valid result, navigate
    const result = state as { phase: "needs_password"; projectId: string };
    setState({ phase: "authed", projectId: result.projectId });
  }

  if (state.phase === "loading") return <LoadingScreen />;
  if (state.phase === "expired") return <ExpiredScreen />;
  if (state.phase === "tampered" || state.phase === "error") return <TamperedScreen />;

  if (state.phase === "needs_password") {
    return (
      <PasswordForm
        projectId={state.projectId}
        rawToken={token}
        onSuccess={handlePasswordSuccess}
      />
    );
  }

  // authed — redirect to owner-app
  const { projectId } = state;
  const base = window.location.origin + window.location.pathname;
  window.location.href = `${base}#/owner-app/${encodeURIComponent(projectId)}?token=${encodeURIComponent(token)}`;
  return <LoadingScreen />;
}
