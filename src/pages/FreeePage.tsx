/**
 * /freee — freee 会計連携ページ（Phase 1）。
 *
 * 出来ること:
 *   - freee 未接続: 「freee に接続」ボタン → /api/freee/auth で URL を取得しリダイレクト
 *   - callback 経由で戻ってきたら code を /api/freee/callback に POST
 *   - 接続済み: 事業所を選んで 請求書 / 取引 を取得して表形式で表示
 *
 * Phase 2 以降:
 *   - Supabase `expenses` テーブルへの同期
 *   - 請求書と入金の自動照合
 *   - webhook
 */

import { useEffect, useState } from "react";
import { getSupabaseClient, hasSupabaseEnv } from "../infra/supabase-client.js";
import type { Company, Deal, Invoice } from "../lib/freee/types.js";

type FetchState = "idle" | "loading" | "error";

async function getAuthToken(): Promise<string | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** /#/freee?code=... で戻ってきたときに code を抜き出す（hash route と共存） */
function extractCodeFromUrl(): string | null {
  // query は hash の後ろにも前にも入りうる。両方見る。
  const search = new URLSearchParams(window.location.search);
  if (search.get("code")) return search.get("code");
  const hash = window.location.hash;
  const q = hash.indexOf("?");
  if (q === -1) return null;
  const hashQs = new URLSearchParams(hash.slice(q + 1));
  return hashQs.get("code");
}

export function FreeePage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectState, setConnectState] = useState<FetchState>("idle");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);

  // ── 接続状態チェック ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasSupabaseEnv()) {
        setConnected(false);
        return;
      }
      try {
        const supabase = await getSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          if (!cancelled) setConnected(false);
          return;
        }
        const { data } = await supabase
          .from("freee_tokens")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!cancelled) setConnected(Boolean(data));
      } catch {
        if (!cancelled) setConnected(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── /#/freee?code=... で戻ってきた場合の処理 ────────
  useEffect(() => {
    const code = extractCodeFromUrl();
    if (!code) return;
    (async () => {
      setConnectState("loading");
      setError(null);
      try {
        const token = await getAuthToken();
        if (!token) throw new Error("ログインが必要です");
        const res = await fetch("/api/freee/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setConnected(true);
        setConnectState("idle");
        // URL から code を消す
        window.history.replaceState(null, "", `${window.location.pathname}#/freee`);
      } catch (err) {
        setConnectState("error");
        setError(err instanceof Error ? err.message : "連携に失敗しました");
      }
    })();
  }, []);

  // ── 接続開始 ────────────────────────────────────────
  async function handleConnect() {
    setConnectState("loading");
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("ログインが必要です");
      const res = await fetch("/api/freee/auth", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { url: string };
      window.location.href = body.url;
    } catch (err) {
      setConnectState("error");
      setError(err instanceof Error ? err.message : "接続に失敗しました");
    }
  }

  // ── 事業所一覧取得 ──────────────────────────────────
  async function loadCompanies() {
    setFetchState("loading");
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("ログインが必要です");
      const res = await fetch("/api/freee/companies", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { companies: Company[] };
      setCompanies(body.companies);
      if (body.companies.length > 0 && selectedCompanyId === null) {
        setSelectedCompanyId(body.companies[0].id);
      }
      setFetchState("idle");
    } catch (err) {
      setFetchState("error");
      setError(err instanceof Error ? err.message : "取得失敗");
    }
  }

  // ── 請求書 / 取引 取得 ──────────────────────────────
  async function fetchResource(kind: "invoices" | "deals") {
    if (selectedCompanyId === null) return;
    setFetchState("loading");
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("ログインが必要です");
      const res = await fetch(
        `/api/freee/${kind}?company_id=${selectedCompanyId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as {
        invoices?: Invoice[];
        deals?: Deal[];
      };
      if (kind === "invoices") setInvoices(body.invoices ?? []);
      else setDeals(body.deals ?? []);
      setFetchState("idle");
    } catch (err) {
      setFetchState("error");
      setError(err instanceof Error ? err.message : "取得失敗");
    }
  }

  const renderContent = () => {
    if (connected === null) {
      return <p className="text-sm text-slate-500">読み込み中...</p>;
    }
    if (!connected) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-900">freee を連携する</h2>
          <p className="mt-2 text-sm text-slate-600">
            freee 会計と連携すると、請求書と取引の取得ができるようになります。
            ボタンを押すと freee の認可画面に遷移します。
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connectState === "loading"}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {connectState === "loading" ? "接続中..." : "freee に接続"}
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">事業所</h2>
            <button
              type="button"
              onClick={loadCompanies}
              disabled={fetchState === "loading"}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              事業所を取得
            </button>
          </div>
          {companies.length > 0 ? (
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm text-slate-600">選択中:</label>
              <select
                value={selectedCompanyId ?? ""}
                onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name ?? c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">まだ取得していません</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">データ取得</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fetchResource("invoices")}
                disabled={selectedCompanyId === null || fetchState === "loading"}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                請求書を取得
              </button>
              <button
                type="button"
                onClick={() => fetchResource("deals")}
                disabled={selectedCompanyId === null || fetchState === "loading"}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                取引を取得
              </button>
            </div>
          </div>

          {invoices.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <p className="mb-2 text-xs font-semibold text-slate-500">
                請求書（{invoices.length} 件）
              </p>
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">発行日</th>
                    <th className="px-3 py-2 text-left">請求番号</th>
                    <th className="px-3 py-2 text-left">取引先</th>
                    <th className="px-3 py-2 text-right">金額</th>
                    <th className="px-3 py-2 text-left">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{inv.issue_date}</td>
                      <td className="px-3 py-2">{inv.invoice_number}</td>
                      <td className="px-3 py-2">{inv.partner_name ?? "-"}</td>
                      <td className="px-3 py-2 text-right">
                        {inv.total_amount.toLocaleString("ja-JP")}
                      </td>
                      <td className="px-3 py-2">{inv.invoice_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {deals.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <p className="mb-2 text-xs font-semibold text-slate-500">
                取引（{deals.length} 件）
              </p>
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">発生日</th>
                    <th className="px-3 py-2 text-left">種別</th>
                    <th className="px-3 py-2 text-left">取引先</th>
                    <th className="px-3 py-2 text-right">金額</th>
                    <th className="px-3 py-2 text-left">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d) => (
                    <tr key={d.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{d.issue_date}</td>
                      <td className="px-3 py-2">
                        {d.type === "income" ? "収入" : "支出"}
                      </td>
                      <td className="px-3 py-2">{d.partner_name ?? "-"}</td>
                      <td className="px-3 py-2 text-right">
                        {d.amount.toLocaleString("ja-JP")}
                      </td>
                      <td className="px-3 py-2">
                        {d.status === "settled" ? "決済済" : "未決済"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">freee 連携</h1>
        <p className="mt-1 text-sm text-slate-500">
          freee 会計から請求書・取引を取得します（Phase 1: 読み取りのみ）
        </p>
      </header>
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      {renderContent()}
    </div>
  );
}
