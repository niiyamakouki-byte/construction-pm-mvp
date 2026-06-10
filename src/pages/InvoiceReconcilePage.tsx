/**
 * /invoices/reconcile — freee 入金照合ページ
 *
 * GenbaHub の請求書一覧と freee キャッシュ取引を照合して表示する。
 * 「同期」ボタンで `/api/freee/deals` を叩いて取引を取得し、MatchingEngine で候補を再計算する。
 * 確定時は invoice-store の status を「振込済」に更新する（永続化）。
 * freee 未連携・認証切れは「freee 連携が必要です」案内を表示する。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { InvoiceMatchPanel } from "../components/InvoiceMatchPanel.js";
import { FreeeRepository } from "../lib/freee/FreeeRepository.js";
import { matchInvoicesToFreeeDeals } from "../lib/freee/MatchingEngine.js";
import { getAllInvoices, getInvoice, updateInvoiceStatus } from "../lib/invoice-store.js";
import { pushPaymentConfirmedNotification } from "../lib/notifications.js";
import type { FreeeDeal, MatchResult } from "../lib/freee/MatchingEngine.js";
import type { Company, Deal } from "../lib/freee/types.js";
import { getSupabaseClient, hasSupabaseEnv } from "../infra/supabase-client.js";
import type { MatchAction } from "../components/InvoiceMatchPanel.js";

type PageState = "loading" | "ready" | "error";
type ConnectionState = "ok" | "disconnected" | "expired";

async function getAuthToken(): Promise<string | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** freee API Deal → MatchingEngine の FreeeDeal にマッピング */
export function freeeDealToMatchingDeal(deal: Deal): FreeeDeal {
  return {
    id: deal.id,
    issue_date: deal.issue_date,
    amount: deal.amount,
    partner_name: deal.partner_name,
    ref_number: deal.ref_number,
    // freee API status は "unsettled" | "settled"。MatchingEngine 側は "partial" も扱うので as 利用。
    status: deal.status,
  };
}

export function InvoiceReconcilePage() {
  const repo = useMemo(() => new FreeeRepository(), []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [matchResult, setMatchResult] = useState<MatchResult>({
    matched: [],
    unmatched: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("ok");

  // ── データロード ─────────────────────────────────

  const load = useCallback(async () => {
    setPageState("loading");
    setError(null);
    try {
      const invoices = getAllInvoices();
      // organization_id は JWT から取得するが、ここでは空文字でキャッシュ全件取得
      const deals = await repo.listCachedDeals("", {});
      const result = matchInvoicesToFreeeDeals(invoices, deals);
      setMatchResult(result);
      setPageState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの読み込みに失敗しました");
      setPageState("error");
    }
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── freee 同期 ───────────────────────────────────

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setConnection("disconnected");
        throw new Error("ログインしてください");
      }

      const companiesRes = await fetch("/api/freee/companies", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (companiesRes.status === 401) {
        setConnection("expired");
        throw new Error("freee 認証が切れています。再連携してください");
      }
      if (!companiesRes.ok) {
        const body = (await companiesRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `companies 取得失敗 (${companiesRes.status})`);
      }
      const { companies } = (await companiesRes.json()) as { companies: Company[] };
      if (!companies?.length) {
        setConnection("disconnected");
        throw new Error("freee に事業所がありません。連携設定を確認してください");
      }
      const companyId = companies[0].id;

      const dealsRes = await fetch(`/api/freee/deals?company_id=${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (dealsRes.status === 401) {
        setConnection("expired");
        throw new Error("freee 認証が切れています。再連携してください");
      }
      if (!dealsRes.ok) {
        const body = (await dealsRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `deals 取得失敗 (${dealsRes.status})`);
      }
      const { deals } = (await dealsRes.json()) as { deals: Deal[] };
      const mapped: FreeeDeal[] = deals.map(freeeDealToMatchingDeal);

      // キャッシュ更新（org 空でも upsert 可能 — InMemory はキーに org を含めるだけ）
      await repo.upsertDeals("", companyId, mapped);

      const invoices = getAllInvoices();
      setMatchResult(matchInvoicesToFreeeDeals(invoices, mapped));
      setConnection("ok");
      setSyncMessage(`freee 同期完了: ${mapped.length} 件取得`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "freee 同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  }, [repo]);

  // ── アクション ───────────────────────────────────

  const handleConfirm = useCallback(
    async (action: MatchAction) => {
      try {
        await repo.recordMatch(
          action.invoiceId,
          action.dealId,
          "",
          action.score,
          action.reason,
          action.by,
        );
        // 請求書 status を「振込済」に更新（永続化）
        updateInvoiceStatus(action.invoiceId, "振込済");
        // 入金確定通知を通知パネルに流す
        const invoice = getInvoice(action.invoiceId);
        if (invoice) {
          pushPaymentConfirmedNotification({
            invoiceId: invoice.id,
            invoiceNumber: invoice.id,
            vendorName: invoice.vendorName,
            amount: invoice.total,
            confirmedAt: new Date().toISOString().slice(0, 10),
          });
        }
        setConfirmedCount((n) => n + 1);
        // 照合済みを matched から除外
        setMatchResult((prev) => ({
          matched: prev.matched.filter((c) => c.invoice.id !== action.invoiceId),
          unmatched: prev.unmatched,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "照合確定に失敗しました");
      }
    },
    [repo],
  );

  const handleReject = useCallback((invoiceId: string, _dealId: number) => {
    // 候補を除外して unmatched に移動
    setMatchResult((prev) => {
      const rejected = prev.matched.find(
        (c) => c.invoice.id === invoiceId,
      );
      return {
        matched: prev.matched.filter((c) => c.invoice.id !== invoiceId),
        unmatched: rejected
          ? [...prev.unmatched, rejected.invoice]
          : prev.unmatched,
      };
    });
  }, []);

  const handleAutoMatchAll = useCallback(
    async (actions: MatchAction[]) => {
      for (const action of actions) {
        await handleConfirm(action);
      }
    },
    [handleConfirm],
  );

  // ── レンダリング ─────────────────────────────────

  if (pageState === "loading") {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        照合データを読み込み中...
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">入金照合</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            請求書と freee 取引を突合して自動仕訳を補助します
          </p>
        </div>
        <div className="flex items-center gap-2">
          {confirmedCount > 0 && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {confirmedCount}件 確定済
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {syncing ? "freee 同期中..." : "freee 同期"}
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
          {syncMessage}
        </div>
      )}

      {connection !== "ok" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <p className="font-semibold">freee 連携が必要です</p>
          <p className="mt-1 text-xs">
            {connection === "expired"
              ? "認証が切れています。下のボタンから再連携してください。"
              : "freee と連携すると取引を取得して入金照合ができます。"}
          </p>
          <a
            href="#/freee"
            className="mt-2 inline-block rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            freee 連携画面へ
          </a>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <InvoiceMatchPanel
          matchResult={matchResult}
          onConfirm={(action) => void handleConfirm(action)}
          onReject={handleReject}
          onAutoMatchAll={(actions) => void handleAutoMatchAll(actions)}
        />
      </div>
    </div>
  );
}
