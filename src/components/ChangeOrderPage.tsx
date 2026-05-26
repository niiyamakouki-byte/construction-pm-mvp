/**
 * ChangeOrderPage — 変更管理ワークフロー ダッシュボード (Sprint 17-B)
 *
 * v2-cozy: セージグリーン (#6B8E5A) 軸 / 危険のみ赤 (#C53030) / 装飾最小
 */

import { useState, useEffect, useCallback } from "react";
import type { ChangeOrder, ChangeOrderKind, ChangeOrderStatus } from "../lib/change-order/types.js";
import {
  CHANGE_ORDER_KIND_LABELS,
  CHANGE_ORDER_STATUS_LABELS,
  APPROVAL_ROLE_LABELS,
} from "../lib/change-order/types.js";
import { changeOrderStore } from "../lib/change-order/change-order-store.js";
import {
  createChangeOrder,
  runImpactAnalysis,
  markEstimatingComplete,
  recordOwnerApproval,
  recordSupervisorApproval,
  recordExecutiveApproval,
  requiredApproverRole,
  isDangerousImpact,
  generateChangeOrderDocument,
  listRecentChangeOrders,
} from "../lib/change-order/change-order-facade.js";
import {
  pendingChangeOrders,
  avgApprovalCycleDays,
  costDeltaTotalJpy,
  mostFrequentChangeKind,
} from "../lib/change-order/portfolio-change-order-metrics.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE = "#6B8E5A";
const DANGER = "#C53030";

const ORDERED_KINDS: ChangeOrderKind[] = [
  "addition",
  "modification",
  "deletion",
  "materialUpgrade",
  "scheduleShift",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatJpy(jpy: number): string {
  const abs = Math.abs(jpy);
  const sign = jpy < 0 ? "▲" : jpy > 0 ? "+" : "";
  return `${sign}¥${abs.toLocaleString("ja-JP")}`;
}

function formatDateJa(iso: string): string {
  const dt = new Date(iso);
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`;
}

function statusColor(status: ChangeOrderStatus): string {
  if (status === "approved") return SAGE;
  if (status === "rejected") return DANGER;
  if (status === "ownerApproval" || status === "supervisorApproval" || status === "executiveApproval") return "#d97706";
  return "#64748b";
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 shadow-sm px-5 py-4">
      <div className="text-xs text-slate-400 font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: ChangeOrderStatus }) {
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${statusColor(status)}18`, color: statusColor(status) }}
    >
      {CHANGE_ORDER_STATUS_LABELS[status]}
    </span>
  );
}

function ChangeOrderRow({
  co,
  onSelect,
}: {
  co: ChangeOrder;
  onSelect: (co: ChangeOrder) => void;
}) {
  const dangerous = co.impactAnalysis && isDangerousImpact(co.impactAnalysis);

  return (
    <button
      type="button"
      onClick={() => onSelect(co)}
      className="w-full flex items-center gap-3 py-3 px-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-slate-500">{CHANGE_ORDER_KIND_LABELS[co.kind]}</span>
          {dangerous && (
            <span className="text-xs font-bold" style={{ color: DANGER }}>⚠ 10%超</span>
          )}
        </div>
        <div className="text-sm text-slate-700 truncate">{co.descriptionJa}</div>
        <div className="text-xs text-slate-400 mt-0.5">{co.requestedBy} · {formatDateJa(co.requestedAt)}</div>
      </div>
      <div className="shrink-0">
        <StatusBadge status={co.status} />
      </div>
    </button>
  );
}

function ApprovalFlowProgress({ co }: { co: ChangeOrder }) {
  const stages: Array<{ label: string; status: ChangeOrderStatus }> = [
    { label: "施主", status: "ownerApproval" },
    { label: "監督", status: "supervisorApproval" },
    { label: "社長", status: "executiveApproval" },
  ];

  const statusOrder: ChangeOrderStatus[] = [
    "requested", "estimating", "ownerApproval", "supervisorApproval", "executiveApproval", "approved", "rejected",
  ];

  const currentIdx = statusOrder.indexOf(co.status);

  return (
    <div className="flex items-center gap-1 mt-3">
      {stages.map((stage, i) => {
        const stageIdx = statusOrder.indexOf(stage.status);
        const isDone = currentIdx > stageIdx;
        const isActive = currentIdx === stageIdx;
        const isRejected = co.status === "rejected";

        return (
          <div key={stage.status} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className="h-0.5 w-6"
                style={{ background: isDone ? SAGE : "#e2e8f0" }}
              />
            )}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                background: isDone ? SAGE : isActive ? (isRejected ? DANGER : "#fef3c7") : "#f1f5f9",
                color: isDone ? "#fff" : isActive ? (isRejected ? DANGER : "#92400e") : "#94a3b8",
              }}
              title={stage.label}
            >
              {isDone ? "✓" : stage.label.slice(0, 1)}
            </div>
          </div>
        );
      })}
      {co.status === "approved" && (
        <span className="ml-2 text-xs font-bold" style={{ color: SAGE }}>承認完了</span>
      )}
      {co.status === "rejected" && (
        <span className="ml-2 text-xs font-bold" style={{ color: DANGER }}>却下</span>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function ChangeOrderPage() {
  const [orders, setOrders] = useState<ChangeOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ChangeOrder | null>(null);
  const [view, setView] = useState<"list" | "detail" | "create">("list");

  // Create form
  const [createProjectId, setCreateProjectId] = useState("proj-001");
  const [createKind, setCreateKind] = useState<ChangeOrderKind>("modification");
  const [createDesc, setCreateDesc] = useState("");
  const [createRequestedBy, setCreateRequestedBy] = useState("");
  const [createWorkItem, setCreateWorkItem] = useState("");

  // Approval
  const [approverName, setApproverName] = useState("");
  const [approvalComment, setApprovalComment] = useState("");

  // Document preview
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [docCopied, setDocCopied] = useState(false);

  // Metrics
  const [metricsPending, setMetricsPending] = useState(0);
  const [metricsAvgCycle, setMetricsAvgCycle] = useState(0);
  const [metricsCostDelta, setMetricsCostDelta] = useState(0);
  const [metricsTopKind, setMetricsTopKind] = useState<ChangeOrderKind | null>(null);

  const refreshOrders = useCallback(() => {
    setOrders(listRecentChangeOrders(50));
    setMetricsPending(pendingChangeOrders());
    setMetricsAvgCycle(avgApprovalCycleDays());
    setMetricsCostDelta(costDeltaTotalJpy());
    setMetricsTopKind(mostFrequentChangeKind());
  }, []);

  useEffect(() => {
    refreshOrders();
    const unsub = changeOrderStore.subscribe(() => refreshOrders());
    return unsub;
  }, [refreshOrders]);

  // Refresh selected order from store when orders update
  useEffect(() => {
    if (selectedOrder) {
      const fresh = orders.find((o) => o.id === selectedOrder.id) ?? null;
      setSelectedOrder(fresh);
    }
  }, [orders, selectedOrder?.id]);

  const handleCreate = () => {
    if (!createDesc.trim() || !createRequestedBy.trim()) return;
    const co = createChangeOrder({
      projectId: createProjectId,
      kind: createKind,
      descriptionJa: createDesc,
      requestedBy: createRequestedBy,
      targetWorkItem: createWorkItem || undefined,
    });
    setCreateDesc("");
    setCreateRequestedBy("");
    setCreateWorkItem("");
    setSelectedOrder(co);
    setView("detail");
  };

  const handleRunImpact = () => {
    if (!selectedOrder) return;
    const updated = runImpactAnalysis(selectedOrder.id, {
      originalLines: [],
      newLines: [],
      phases: [],
      baseContractJpy: 5_000_000,
    });
    if (updated) setSelectedOrder(updated);
  };

  const handleMarkEstimating = () => {
    if (!selectedOrder) return;
    const updated = markEstimatingComplete(selectedOrder.id);
    if (updated) setSelectedOrder(updated);
  };

  const handleApprove = () => {
    if (!selectedOrder || !approverName.trim()) return;
    const role = requiredApproverRole(selectedOrder);
    if (!role) return;

    let updated: ChangeOrder | null = null;
    if (role === "owner") {
      updated = recordOwnerApproval(selectedOrder.id, approverName, "approved", approvalComment || undefined);
    } else if (role === "supervisor") {
      updated = recordSupervisorApproval(selectedOrder.id, approverName, "approved", approvalComment || undefined);
    } else if (role === "executive") {
      updated = recordExecutiveApproval(selectedOrder.id, approverName, "approved", approvalComment || undefined);
    }
    if (updated) {
      setSelectedOrder(updated);
      setApproverName("");
      setApprovalComment("");
    }
  };

  const handleReject = () => {
    if (!selectedOrder || !approverName.trim()) return;
    const role = requiredApproverRole(selectedOrder);
    if (!role) return;

    let updated: ChangeOrder | null = null;
    if (role === "owner") {
      updated = recordOwnerApproval(selectedOrder.id, approverName, "rejected", approvalComment || undefined);
    } else if (role === "supervisor") {
      updated = recordSupervisorApproval(selectedOrder.id, approverName, "rejected", approvalComment || undefined);
    } else if (role === "executive") {
      updated = recordExecutiveApproval(selectedOrder.id, approverName, "rejected", approvalComment || undefined);
    }
    if (updated) {
      setSelectedOrder(updated);
      setApproverName("");
      setApprovalComment("");
    }
  };

  const handlePreviewDoc = () => {
    if (!selectedOrder) return;
    const doc = generateChangeOrderDocument(selectedOrder.id, "markdown");
    setDocPreview(doc);
    setDocCopied(false);
  };

  const handleCopyDoc = async () => {
    if (!docPreview) return;
    try {
      await navigator.clipboard.writeText(docPreview);
      setDocCopied(true);
      setTimeout(() => setDocCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const ia = selectedOrder?.impactAnalysis;
  const requiredRole = selectedOrder ? requiredApproverRole(selectedOrder) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">変更管理</h1>
            <p className="text-xs text-slate-400 mt-0.5">Sprint 17-B — 追加/変更要望の影響分析と承認フロー</p>
          </div>
          <button
            type="button"
            onClick={() => { setView("create"); setSelectedOrder(null); setDocPreview(null); }}
            className="text-sm font-medium px-4 py-2 rounded-lg text-white"
            style={{ background: SAGE }}
          >
            + 新規変更要望
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="承認待ち" value={metricsPending} sub="件" />
          <KpiCard label="平均承認サイクル" value={metricsAvgCycle} sub="日" />
          <KpiCard label="変更金額合計" value={formatJpy(metricsCostDelta)} />
          <KpiCard
            label="最多変更種別"
            value={metricsTopKind ? CHANGE_ORDER_KIND_LABELS[metricsTopKind] : "—"}
          />
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2 border-b border-slate-200">
          {(["list", "create"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setView(v); if (v === "list") setSelectedOrder(null); }}
              className="text-sm font-medium px-3 py-2 border-b-2 transition-colors"
              style={{
                borderColor: view === v || (view === "detail" && v === "list") ? SAGE : "transparent",
                color: view === v || (view === "detail" && v === "list") ? SAGE : "#64748b",
              }}
            >
              {v === "list" ? "一覧" : "新規作成"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: list or create */}
          <div>
            {view === "create" ? (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
                <h2 className="text-sm font-bold text-slate-700">変更要望を入力</h2>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">案件ID</label>
                    <input
                      type="text"
                      value={createProjectId}
                      onChange={(e) => setCreateProjectId(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                      style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">変更種別</label>
                    <select
                      value={createKind}
                      onChange={(e) => setCreateKind(e.target.value as ChangeOrderKind)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                      style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
                    >
                      {ORDERED_KINDS.map((k) => (
                        <option key={k} value={k}>{CHANGE_ORDER_KIND_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">変更内容</label>
                    <textarea
                      value={createDesc}
                      onChange={(e) => setCreateDesc(e.target.value)}
                      rows={3}
                      placeholder="変更の内容を詳しく入力してください"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 resize-none"
                      style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">要望者名</label>
                    <input
                      type="text"
                      value={createRequestedBy}
                      onChange={(e) => setCreateRequestedBy(e.target.value)}
                      placeholder="例: 田中様"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                      style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">対象工事箇所 (任意)</label>
                    <input
                      type="text"
                      value={createWorkItem}
                      onChange={(e) => setCreateWorkItem(e.target.value)}
                      placeholder="例: 壁仕上げ工事"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                      style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!createDesc.trim() || !createRequestedBy.trim()}
                  className="w-full text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-40"
                  style={{ background: SAGE }}
                >
                  変更要望を登録
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="px-5 py-3 border-b border-slate-50">
                  <h2 className="text-sm font-bold text-slate-700">変更指示一覧</h2>
                </div>
                {orders.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-400">変更要望はまだありません</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {orders.map((co) => (
                      <ChangeOrderRow
                        key={co.id}
                        co={co}
                        onSelect={(c) => { setSelectedOrder(c); setView("detail"); setDocPreview(null); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: detail */}
          {selectedOrder && (
            <div className="space-y-4">
              {/* Main card */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">{CHANGE_ORDER_KIND_LABELS[selectedOrder.kind]}</div>
                    <h3 className="text-base font-bold text-slate-800">{selectedOrder.descriptionJa}</h3>
                    {selectedOrder.targetWorkItem && (
                      <div className="text-xs text-slate-500 mt-0.5">対象: {selectedOrder.targetWorkItem}</div>
                    )}
                  </div>
                  <StatusBadge status={selectedOrder.status} />
                </div>

                <div className="text-xs text-slate-400">
                  {selectedOrder.requestedBy} · {formatDateJa(selectedOrder.requestedAt)}
                </div>

                {/* Approval progress */}
                <ApprovalFlowProgress co={selectedOrder} />

                {/* Workflow actions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedOrder.status === "requested" && (
                    <button
                      type="button"
                      onClick={handleRunImpact}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      影響分析を実行
                    </button>
                  )}
                  {selectedOrder.status === "estimating" && (
                    <button
                      type="button"
                      onClick={handleMarkEstimating}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
                      style={{ background: SAGE }}
                    >
                      見積完了 → 施主承認へ
                    </button>
                  )}
                </div>
              </div>

              {/* Impact analysis */}
              {ia && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <h4 className="text-sm font-bold text-slate-700 mb-3">影響分析</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-xs text-slate-400">金額差分</div>
                      <div
                        className="text-lg font-bold mt-0.5"
                        style={{ color: ia.costDeltaJpy > 0 ? DANGER : SAGE }}
                      >
                        {formatJpy(ia.costDeltaJpy)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-xs text-slate-400">工期差分</div>
                      <div
                        className="text-lg font-bold mt-0.5"
                        style={{ color: ia.scheduleDeltaDays > 0 ? "#d97706" : SAGE }}
                      >
                        {ia.scheduleDeltaDays > 0 ? "+" : ""}{ia.scheduleDeltaDays}日
                      </div>
                    </div>
                  </div>

                  {isDangerousImpact(ia) && (
                    <div
                      className="text-xs font-bold px-3 py-2 rounded-lg mb-3"
                      style={{ background: "#fef2f2", color: DANGER }}
                    >
                      ⚠ コスト増加率 {ia.costIncreaseRatioPct}% — 危険域 (10%超)
                    </div>
                  )}

                  {ia.affectedTrades.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs text-slate-400 mb-1">影響職種</div>
                      <div className="flex flex-wrap gap-1">
                        {ia.affectedTrades.map((t) => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {ia.dependencyChain.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-400 mb-1">波及連鎖</div>
                      <div className="text-xs text-slate-600 space-y-0.5">
                        {ia.dependencyChain.map((d, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <span className="text-slate-300">→</span>
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Approval panel */}
              {requiredRole && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
                  <h4 className="text-sm font-bold text-slate-700">
                    {APPROVAL_ROLE_LABELS[requiredRole]}承認
                  </h4>
                  <input
                    type="text"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    placeholder={`${APPROVAL_ROLE_LABELS[requiredRole]}のお名前`}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                    style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
                  />
                  <input
                    type="text"
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="コメント (任意)"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                    style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={!approverName.trim()}
                      className="flex-1 text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-40"
                      style={{ background: SAGE }}
                    >
                      承認
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={!approverName.trim()}
                      className="flex-1 text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-40"
                      style={{ background: DANGER }}
                    >
                      却下
                    </button>
                  </div>
                </div>
              )}

              {/* Approval history */}
              {selectedOrder.approvalRecords.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <h4 className="text-sm font-bold text-slate-700 mb-3">承認履歴</h4>
                  <div className="space-y-2">
                    {selectedOrder.approvalRecords.map((rec, i) => {
                      const decisionJa = rec.decision === "approved" ? "承認" : rec.decision === "rejected" ? "却下" : "エスカレート";
                      const decColor = rec.decision === "approved" ? SAGE : rec.decision === "rejected" ? DANGER : "#d97706";
                      return (
                        <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                          <div
                            className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: `${decColor}18`, color: decColor }}
                          >
                            {decisionJa}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-slate-700">{APPROVAL_ROLE_LABELS[rec.role]}: {rec.decidedBy}</div>
                            <div className="text-xs text-slate-400">{formatDateJa(rec.decidedAt)}</div>
                            {rec.comment && <div className="text-xs text-slate-500 mt-0.5 italic">{rec.comment}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Document preview */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-700">変更指示書</h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handlePreviewDoc}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      プレビュー
                    </button>
                    {docPreview && (
                      <button
                        type="button"
                        onClick={handleCopyDoc}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
                        style={{ background: SAGE }}
                      >
                        {docCopied ? "コピー済" : "コピー"}
                      </button>
                    )}
                  </div>
                </div>
                {docPreview && (
                  <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                    {docPreview}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
