/**
 * FreeeAuthPage — freee OAuth 再認証 UI コンポーネント
 *
 * 接続状態:
 *   - disconnected: 「freee と連携する」ボタンを表示
 *   - connected:    接続済みバッジ + 切断ボタン
 *   - expired:      期限切れバナー + 再接続ボタン
 *   - loading:      ローディング表示
 *
 * OAuth フロー:
 *   1. handleConnect() → /api/freee/auth から認可 URL を取得 → リダイレクト
 *   2. freee が /?code=... でコールバック
 *   3. handleCallback() → /api/freee/callback へ code を POST → トークン保存
 *
 * 環境変数:
 *   VITE_FREEE_CLIENT_ID      — freee アプリの Client ID
 *   VITE_FREEE_REDIRECT_URI   — OAuth リダイレクト URI
 */

import { useEffect, useState } from "react";

// ── 型 ────────────────────────────────────────────────

type ConnectionStatus = "loading" | "connected" | "expired" | "disconnected";

type FreeeAuthPageProps = {
  /** 接続完了時のコールバック（省略可） */
  onConnected?: () => void;
  /** 切断時のコールバック（省略可） */
  onDisconnected?: () => void;
};

// ── Helpers ───────────────────────────────────────────

/** localStorage からトークン有効期限を読み取り接続状態を返す */
function readConnectionStatus(): ConnectionStatus {
  const accessToken = localStorage.getItem("freee_access_token");
  const expiresAt = localStorage.getItem("freee_expires_at");

  if (!accessToken || !expiresAt) return "disconnected";

  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return "disconnected";

  // 5 分余裕を持って expired 判定
  const MARGIN_MS = 5 * 60 * 1000;
  if (Date.now() >= expiresMs - MARGIN_MS) return "expired";

  return "connected";
}

/** URL から OAuth code を抜き出す（hash route と共存） */
function extractCodeFromUrl(): string | null {
  const search = new URLSearchParams(window.location.search);
  if (search.get("code")) return search.get("code");
  const hash = window.location.hash;
  const q = hash.indexOf("?");
  if (q === -1) return null;
  return new URLSearchParams(hash.slice(q + 1)).get("code");
}

/** Authorization ヘッダ用の Bearer トークンを取得（Supabase 未使用時は null） */
async function getAuthHeader(): Promise<Record<string, string>> {
  const viteSupabase =
    typeof import.meta !== "undefined"
      ? ((import.meta as unknown as { env?: Record<string, string> }).env)
      : undefined;
  const supabaseUrl = viteSupabase?.["VITE_SUPABASE_URL"];
  if (!supabaseUrl || supabaseUrl.includes("your-project")) return {};

  try {
    // 動的 import でバンドル分割。Supabase 未導入時はエラーを無視する。
    const { getSupabaseClient } = await import("../infra/supabase-client.js");
    const supabase = await getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

// ── Component ─────────────────────────────────────────

export function FreeeAuthPage({ onConnected, onDisconnected }: FreeeAuthPageProps) {
  const [status, setStatus] = useState<ConnectionStatus>(() => readConnectionStatus());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OAuth callback: URL に code があれば自動処理
  useEffect(() => {
    const code = extractCodeFromUrl();
    if (!code) return;

    let cancelled = false;

    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setBusy(true);
      setError(null);

      try {
        const authHeaders = await getAuthHeader();
        const res = await fetch("/api/freee/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ code }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        const data = (await res.json()) as {
          access_token?: string;
          refresh_token?: string;
          expires_at?: string;
        };

        // トークンを localStorage に保存
        if (data.access_token && data.refresh_token && data.expires_at) {
          localStorage.setItem("freee_access_token", data.access_token);
          localStorage.setItem("freee_refresh_token", data.refresh_token);
          localStorage.setItem("freee_expires_at", data.expires_at);
        }

        if (!cancelled) {
          setStatus("connected");
          setBusy(false);
          // URL から code を除去
          window.history.replaceState(null, "", window.location.pathname + window.location.hash.split("?")[0]);
          onConnected?.();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "連携に失敗しました");
          setBusy(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── イベントハンドラ ────────────────────────────────

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeader();
      const res = await fetch("/api/freee/auth", {
        method: "GET",
        headers: authHeaders,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { url: string };
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "接続に失敗しました");
      setBusy(false);
    }
  }

  function handleDisconnect() {
    localStorage.removeItem("freee_access_token");
    localStorage.removeItem("freee_refresh_token");
    localStorage.removeItem("freee_expires_at");
    setStatus("disconnected");
    setError(null);
    onDisconnected?.();
  }

  // ── レンダリング ─────────────────────────────────────

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-bold text-slate-900">会計ソフト連携</h2>

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {status === "connected" ? (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-500" />
            <span className="text-sm font-medium text-slate-700">接続済み</span>
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            連携を解除
          </button>
        </div>
      ) : status === "expired" ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="text-sm text-amber-700">トークンの有効期限が切れています</span>
          </div>
          <p className="text-sm text-slate-600">
            freee との接続を更新するには、再度認証してください。
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "接続中..." : "再接続する"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-600">
            freee 会計と連携すると、案件の取引が自動で登録されます。
            ボタンを押すと freee の認可画面に遷移します。
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "接続中..." : "freee と連携する"}
          </button>
        </div>
      )}
    </div>
  );
}
