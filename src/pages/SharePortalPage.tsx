/**
 * SharePortalPage — 施主向けJWT share-tokenアクセスページ
 * URL: /#/portal/share/<token>
 *
 * - パスワード保護トークンはパスワード入力フォームを表示
 * - 期限切れ/署名不正/不一致は明示的なエラーを表示
 * - 検証成功後は ContractorPortalPage と同じ進捗ビューを表示
 */

import { useEffect, useState } from "react";
import {
  jwtTokenRequiresPassword,
  verifyJwtShareToken,
} from "../lib/share-token-jwt.js";
import type { JwtVerifyResult } from "../lib/share-token-jwt.js";
import { ContractorPortalPage } from "./ContractorPortalPage.js";

type JwtVerifyFailureReason = Extract<JwtVerifyResult, { ok: false }>["reason"];

type VerifyState =
  | { phase: "checking" }
  | { phase: "verified"; token: string; projectId: string }
  | { phase: "error"; reason: JwtVerifyFailureReason };

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm text-center">
        <p className="text-4xl mb-4" aria-hidden="true">🔒</p>
        <h1 className="text-base font-bold text-slate-800">アクセスできません</h1>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}

function PasswordForm({
  token,
  onVerified,
}: {
  token: string;
  onVerified: (projectId: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await verifyJwtShareToken(token, password);
    setLoading(false);
    if (result.ok) {
      onVerified(result.payload.sub);
    } else if (result.reason === "password_mismatch") {
      setError("パスワードが正しくありません");
    } else if (result.reason === "expired") {
      setError("リンクの有効期限が切れています");
    } else {
      setError("無効なリンクです");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <div className="text-center mb-6">
          <p className="text-4xl mb-3" aria-hidden="true">🔑</p>
          <h1 className="text-base font-bold text-slate-800">パスワードを入力してください</h1>
          <p className="mt-1 text-xs text-slate-500">
            このページはパスワードで保護されています
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="share-portal-password"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              パスワード
            </label>
            <input
              id="share-portal-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-brand-800"
          >
            {loading ? "確認中..." : "アクセスする"}
          </button>
        </form>
      </div>
    </div>
  );
}

type Props = {
  token: string;
};

export function SharePortalPage({ token }: Props) {
  const [state, setState] = useState<VerifyState>({ phase: "checking" });
  const requiresPassword = jwtTokenRequiresPassword(token);

  useEffect(() => {
    if (requiresPassword) return;

    // パスワードなし → 直接検証
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        setState({ phase: "checking" });
        return verifyJwtShareToken(token);
      })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setState({ phase: "verified", token, projectId: result.payload.sub });
        } else {
          setState({ phase: "error", reason: result.reason });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requiresPassword, token]);

  const verifiedForCurrentToken = state.phase === "verified" && state.token === token;

  if (requiresPassword && !verifiedForCurrentToken) {
    return (
      <PasswordForm
        token={token}
        onVerified={(projectId) => setState({ phase: "verified", token, projectId })}
      />
    );
  }

  if (state.phase === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">読み込み中...</p>
      </div>
    );
  }

  if (state.phase === "error") {
    const messages: Record<JwtVerifyFailureReason, string> = {
      expired: "リンクの有効期限が切れています。担当者に新しいURLをご依頼ください。",
      invalid_signature: "リンクが無効です。担当者にご確認ください。",
      malformed: "リンクの形式が正しくありません。",
      password_required: "パスワードが必要です。",
      password_mismatch: "パスワードが正しくありません。",
    };
    const msg = messages[state.reason] ?? "アクセスできません。担当者にご確認ください。";
    return <ErrorCard message={msg} />;
  }

  if (!verifiedForCurrentToken) {
    return <ErrorCard message="アクセスできません。担当者にご確認ください。" />;
  }

  return <ContractorPortalPage projectId={state.projectId} />;
}
