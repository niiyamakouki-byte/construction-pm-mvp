/**
 * /invoices/reconcile — freee 入金照合ページ
 *
 * GenbaHub の請求書一覧と freee キャッシュ取引を照合して表示する。
 * FreeeRepository が InMemory モードの場合はサンプルデータで動作する。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { InvoiceMatchPanel } from "../components/InvoiceMatchPanel.js";
import { FreeeRepository } from "../lib/freee/FreeeRepository.js";
import { matchInvoicesToFreeeDeals } from "../lib/freee/MatchingEngine.js";
import { getAllInvoices } from "../lib/invoice-store.js";
import type { MatchResult } from "../lib/freee/MatchingEngine.js";
import type { MatchAction } from "../components/InvoiceMatchPanel.js";

type PageState = "loading" | "ready" | "error";

export function InvoiceReconcilePage() {
  const repo = useMemo(() => new FreeeRepository(), []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [matchResult, setMatchResult] = useState<MatchResult>({
    matched: [],
    unmatched: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmedCount, setConfirmedCount] = useState(0);

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
        {confirmedCount > 0 && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {confirmedCount}件 確定済
          </span>
        )}
      </div>

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
