/**
 * SalesPipelinePage — 営業パイプライン可視化ダッシュボード.
 *
 * Sprint 16-B: v2-cozy デザイン
 * - セージグリーン (#6B8E5A) 軸
 * - 危険のみ赤 (#C53030)
 * - 装飾最小
 */

import { useState, useEffect, useCallback } from "react";
import type { Deal, DealStage, LossReason, RiskAlert, StageMetrics } from "../lib/sales-pipeline/types.js";
import { dealStore, _resetDealStore } from "../lib/sales-pipeline/deal-store.js";
import { transition } from "../lib/sales-pipeline/stage-transition-engine.js";
import { snapshot } from "../lib/sales-pipeline/pipeline-snapshotter.js";
import { analyzeConversionFunnel } from "../lib/sales-pipeline/conversion-analyzer.js";
import { currentDwellDays } from "../lib/sales-pipeline/stall-detector.js";

// ── Constants ──────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<DealStage, string> = {
  inquiry: "問合せ",
  first_reply: "初回返信",
  site_survey: "現調",
  proposal: "提案",
  contract: "契約",
  kickoff: "着工",
  won: "受注",
  lost: "失注",
};

const ORDERED_STAGES: DealStage[] = [
  "inquiry", "first_reply", "site_survey", "proposal",
  "contract", "kickoff", "won", "lost",
];

const ACTIVE_STAGES: DealStage[] = [
  "inquiry", "first_reply", "site_survey", "proposal", "contract", "kickoff",
];

function formatJpy(amount: number): string {
  if (amount >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(1)}億円`;
  }
  if (amount >= 10_000) {
    return `${Math.round(amount / 10_000)}万円`;
  }
  return `${amount.toLocaleString("ja-JP")}円`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  danger = false,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 shadow-sm px-5 py-4">
      <div className="text-xs text-slate-500 font-medium mb-1">{label}</div>
      <div
        className={`text-2xl font-bold leading-tight ${
          danger ? "text-[#C53030]" : "text-slate-900"
        }`}
      >
        {value}
      </div>
      {sub ? <div className="text-xs text-slate-400 mt-0.5">{sub}</div> : null}
    </div>
  );
}

// ── Risk Alert Badge ───────────────────────────────────────────────────────

function AlertBadge({ alert }: { alert: RiskAlert }) {
  const colorClass =
    alert.severity === "critical"
      ? "bg-[#C53030] text-white"
      : alert.severity === "warn"
      ? "bg-amber-100 text-amber-800 border border-amber-300"
      : "bg-slate-100 text-slate-600";

  return (
    <div className={`rounded-lg px-3 py-2 text-sm ${colorClass}`}>
      <span className="font-semibold mr-1">
        {alert.severity === "critical" ? "緊急" : alert.severity === "warn" ? "警告" : "情報"}
      </span>
      {alert.message}
    </div>
  );
}

// ── Stall Badge ───────────────────────────────────────────────────────────

function StallBadge({ days }: { days: number }) {
  const color =
    days >= 14
      ? "bg-[#C53030] text-white"
      : days >= 7
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-500";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${color}`}>
      {days}日
    </span>
  );
}

// ── Stage Modal ────────────────────────────────────────────────────────────

function DealDetailModal({
  deal,
  onClose,
  onTransition,
}: {
  deal: Deal;
  onClose: () => void;
  onTransition: (dealId: string, toStage: DealStage) => void;
}) {
  const availableStages = ORDERED_STAGES.filter(
    (s) => s !== deal.currentStage,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {deal.customerName}
              </h2>
              <span className="text-sm text-[#6B8E5A] font-medium">
                {STAGE_LABELS[deal.currentStage]}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-400">期待金額</span>
              <div className="font-semibold text-slate-900">
                {formatJpy(deal.expectedAmountJpy)}
              </div>
            </div>
            <div>
              <span className="text-slate-400">確度</span>
              <div className="font-semibold text-slate-900">
                {deal.probabilityPct}%
              </div>
            </div>
            <div>
              <span className="text-slate-400">クローズ予定</span>
              <div className="font-semibold text-slate-900">
                {deal.expectedCloseDate}
              </div>
            </div>
            <div>
              <span className="text-slate-400">担当</span>
              <div className="font-semibold text-slate-900">
                {deal.ownerName}
              </div>
            </div>
          </div>

          {deal.stageHistory.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                ステージ履歴
              </h3>
              <div className="space-y-1">
                {deal.stageHistory.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-[#6B8E5A]">{STAGE_LABELS[t.fromStage]}</span>
                    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-slate-300" aria-hidden="true">
                      <path d="M3 8h10m-3-3 3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span className="text-[#6B8E5A]">{STAGE_LABELS[t.toStage]}</span>
                    <span className="text-slate-400 text-xs ml-auto">
                      {t.daysInPreviousStage}日後
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {deal.notes ? (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                メモ
              </h3>
              <p className="text-sm text-slate-600 line-clamp-3">{deal.notes}</p>
            </div>
          ) : null}

          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              ステージ遷移
            </h3>
            <div className="flex flex-wrap gap-2">
              {availableStages.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => {
                    onTransition(deal.id, stage);
                    onClose();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    stage === "won"
                      ? "bg-[#6B8E5A] text-white border-[#6B8E5A]"
                      : stage === "lost"
                      ? "bg-[#C53030] text-white border-[#C53030]"
                      : "bg-white text-slate-700 border-slate-200 hover:border-[#6B8E5A]"
                  }`}
                >
                  {STAGE_LABELS[stage]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Deal Card ─────────────────────────────────────────────────────────────

function DealCard({
  deal,
  onClick,
}: {
  deal: Deal;
  onClick: () => void;
}) {
  const dwell = currentDwellDays(deal);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-3 hover:border-[#6B8E5A] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {deal.customerName}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {formatJpy(deal.expectedAmountJpy)} / {deal.probabilityPct}%
          </div>
        </div>
        <StallBadge days={dwell} />
      </div>
    </button>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  deals,
  onDealClick,
}: {
  stage: DealStage;
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
}) {
  const isTerminal = stage === "won" || stage === "lost";
  const totalAmount = deals.reduce((sum, d) => sum + d.expectedAmountJpy, 0);

  return (
    <div className="min-w-[160px] flex-shrink-0">
      <div
        className={`px-3 py-2 rounded-t-lg text-xs font-semibold flex items-center justify-between ${
          stage === "won"
            ? "bg-[#6B8E5A] text-white"
            : stage === "lost"
            ? "bg-[#C53030] text-white"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        <span>{STAGE_LABELS[stage]}</span>
        <span className="opacity-70">{deals.length}</span>
      </div>
      <div className="rounded-b-lg border border-slate-100 border-t-0 bg-slate-50 p-2 space-y-2 min-h-[80px]">
        {deals.map((deal) =>
          isTerminal ? (
            <div
              key={deal.id}
              className="bg-white rounded-lg border border-slate-100 px-3 py-2 text-xs text-slate-600"
            >
              <div className="font-medium truncate">{deal.customerName}</div>
              <div>{formatJpy(deal.expectedAmountJpy)}</div>
            </div>
          ) : (
            <DealCard key={deal.id} deal={deal} onClick={() => onDealClick(deal)} />
          ),
        )}
        {deals.length === 0 && (
          <div className="text-center text-xs text-slate-300 py-4">なし</div>
        )}
        {!isTerminal && deals.length > 0 && (
          <div className="text-center text-xs text-slate-400 pt-1">
            {formatJpy(totalAmount)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export function SalesPipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showingSampleData, setShowingSampleData] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [funnelMetrics, setFunnelMetrics] = useState<StageMetrics[]>([]);
  const [activeTab, setActiveTab] = useState<"kanban" | "stalled" | "alerts">("kanban");

  const refresh = useCallback(() => {
    dealStore.ensureSeed();
    const all = dealStore.getAll();
    setDeals(all);
    setShowingSampleData(dealStore.isSampleData());
    setFunnelMetrics(analyzeConversionFunnel(all));
  }, []);

  useEffect(() => {
    refresh();
    const unsub = dealStore.subscribe(() => refresh());
    return unsub;
  }, [refresh]);

  const snap = snapshot(deals);

  const handleStartEmpty = useCallback(() => {
    dealStore.startEmpty();
    refresh();
  }, [refresh]);

  const handleTransition = useCallback(
    (dealId: string, toStage: DealStage) => {
      const deal = dealStore.byId(dealId);
      if (!deal) return;
      const updated = transition(deal, toStage);
      dealStore.save(updated);
    },
    [],
  );

  const dealsByStage = ORDERED_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = deals.filter((d) => d.currentStage === stage);
      return acc;
    },
    {} as Record<DealStage, Deal[]>,
  );

  const highRiskCount = new Set(
    snap.riskAlerts.filter((a) => a.severity === "critical").map((a) => a.dealId),
  ).size;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">営業パイプライン</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          問合せから受注までの商談進捗を可視化
        </p>
      </div>

      {showingSampleData ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#B8C9AE] bg-[#F2F6EF] px-4 py-3"
          role="status"
        >
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#6B8E5A] px-2.5 py-1 text-xs font-bold text-white">
              サンプルデータ
            </span>
            <p className="text-sm text-slate-600">操作体験用の架空の商談です</p>
          </div>
          <button
            type="button"
            onClick={handleStartEmpty}
            className="rounded-lg border border-[#6B8E5A] bg-white px-3 py-2 text-sm font-semibold text-[#58764A] hover:bg-[#E8F0E3]"
          >
            空状態から始める
          </button>
        </div>
      ) : null}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="総商談数"
          value={`${snap.totalDeals}件`}
          sub="進行中"
        />
        <KpiCard
          label="加重パイプライン"
          value={formatJpy(snap.weightedPipelineJpy)}
          sub="確度加重合計"
        />
        <KpiCard
          label="今月期待売上"
          value={`${snap.expectedClosesThisMonth}件`}
          sub="クローズ予定"
        />
        <KpiCard
          label="高リスク商談"
          value={`${highRiskCount}件`}
          danger={highRiskCount > 0}
          sub="要対応"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-100">
        {(["kanban", "stalled", "alerts"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-[#6B8E5A] text-[#6B8E5A]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "kanban" ? "カンバン" : tab === "stalled" ? `滞留 (${snap.stalledDeals.length})` : `アラート (${snap.riskAlerts.length})`}
          </button>
        ))}
      </div>

      {/* Kanban */}
      {activeTab === "kanban" && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3" style={{ minWidth: "max-content" }}>
            {ORDERED_STAGES.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                deals={dealsByStage[stage] ?? []}
                onDealClick={setSelectedDeal}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stalled */}
      {activeTab === "stalled" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            標準滞留日数を超えている商談
          </p>
          {snap.stalledDeals.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              滞留商談はありません
            </div>
          ) : (
            snap.stalledDeals.map((deal) => {
              const dwell = currentDwellDays(deal);
              return (
                <button
                  key={deal.id}
                  type="button"
                  onClick={() => setSelectedDeal(deal)}
                  className="w-full text-left bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 hover:border-[#6B8E5A]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {deal.customerName}
                      </div>
                      <div className="text-sm text-slate-500">
                        {STAGE_LABELS[deal.currentStage]} / {formatJpy(deal.expectedAmountJpy)}
                      </div>
                    </div>
                    <StallBadge days={dwell} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Alerts */}
      {activeTab === "alerts" && (
        <div className="space-y-2">
          {snap.riskAlerts.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              リスクアラートはありません
            </div>
          ) : (
            snap.riskAlerts.map((alert, i) => (
              <AlertBadge key={`${alert.dealId}-${alert.alertType}-${i}`} alert={alert} />
            ))
          )}
        </div>
      )}

      {/* Deal Detail Modal */}
      {selectedDeal ? (
        <DealDetailModal
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onTransition={handleTransition}
        />
      ) : null}
    </div>
  );
}
