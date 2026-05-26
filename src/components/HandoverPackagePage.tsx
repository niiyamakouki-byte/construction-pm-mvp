/**
 * HandoverPackagePage — 引渡しパッケージ自動生成 ダッシュボード (Sprint 17-C)
 *
 * v2-cozy: セージグリーン (#6B8E5A) 軸 / 危険のみ赤 (#C53030) / 装飾最小
 */

import { useState, useEffect, useCallback } from "react";
import type { HandoverPackage, HandoverDocumentKind } from "../lib/handover-package/types.js";
import {
  DOCUMENT_KIND_LABELS,
  PACKAGE_STATUS_LABELS,
} from "../lib/handover-package/types.js";
import { handoverPackageStore } from "../lib/handover-package/handover-package-store.js";
import {
  createHandoverPackage,
  collectDocuments,
  scheduleMaintenanceMilestones,
  markReview,
  markDelivered,
  archivePackage,
  generateHandoverDocument,
  listRecentHandoverPackages,
} from "../lib/handover-package/handover-package-facade.js";
import {
  pendingHandoverPackages,
  avgHandoverPreparationDays,
  expiringWarranties,
  mostFrequentDocumentKind,
} from "../lib/handover-package/portfolio-handover-metrics.js";
import { buildDocumentChecklist } from "../lib/handover-package/handover-pdf-builder.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE = "#6B8E5A";
const DANGER = "#C53030";

const EQUIPMENT_PRESETS = [
  "エアコン",
  "給湯器",
  "換気扇",
  "IHコンロ",
  "ユニットバス",
  "トイレ",
  "インターホン",
  "洗面台",
  "システムキッチン",
  "床暖房",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateJa(iso: string): string {
  const dt = new Date(iso);
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`;
}

function statusColor(status: HandoverPackage["status"]): string {
  if (status === "delivered") return SAGE;
  if (status === "archived") return "#94a3b8";
  if (status === "review") return "#d97706";
  if (status === "documents_collected") return "#3b82f6";
  return "#64748b"; // draft
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 shadow-sm px-5 py-4">
      <div className="text-xs text-slate-400 font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color: warn ? DANGER : "#1e293b" }}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: HandoverPackage["status"] }) {
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${statusColor(status)}18`, color: statusColor(status) }}
    >
      {PACKAGE_STATUS_LABELS[status]}
    </span>
  );
}

function PackageRow({
  pkg,
  onSelect,
}: {
  pkg: HandoverPackage;
  onSelect: (pkg: HandoverPackage) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(pkg)}
      className="w-full flex items-center gap-3 py-3 px-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-700 truncate">{pkg.ownerName} 様</div>
        <div className="text-xs text-slate-400 mt-0.5">
          {pkg.projectId} · 完成: {formatDateJa(pkg.completedAt)}
        </div>
        <div className="text-xs text-slate-400 mt-0.5">
          書類: {pkg.documents.length}件 / 点検: {pkg.maintenanceSchedule.length}件
        </div>
      </div>
      <div className="shrink-0">
        <StatusBadge status={pkg.status} />
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function HandoverPackagePage() {
  const [packages, setPackages] = useState<HandoverPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<HandoverPackage | null>(null);
  const [view, setView] = useState<"list" | "detail" | "create">("list");

  // Create form
  const [createProjectId, setCreateProjectId] = useState("proj-001");
  const [createOwnerName, setCreateOwnerName] = useState("");
  const [createCompletedAt, setCreateCompletedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );

  // Equipment selection
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());
  const [customEquipment, setCustomEquipment] = useState("");

  // Document checklist
  const [checkedDocIds, setCheckedDocIds] = useState<Set<string>>(new Set());

  // Document preview
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [docCopied, setDocCopied] = useState(false);

  // Metrics
  const [metricsPending, setMetricsPending] = useState(0);
  const [metricsAvgDays, setMetricsAvgDays] = useState(0);
  const [metricsExpiring, setMetricsExpiring] = useState(0);
  const [metricsTopKind, setMetricsTopKind] = useState<HandoverDocumentKind | null>(null);

  const refreshPackages = useCallback(() => {
    setPackages(listRecentHandoverPackages(50));
    setMetricsPending(pendingHandoverPackages());
    setMetricsAvgDays(avgHandoverPreparationDays());
    setMetricsExpiring(expiringWarranties(30));
    setMetricsTopKind(mostFrequentDocumentKind());
  }, []);

  useEffect(() => {
    refreshPackages();
    const unsub = handoverPackageStore.subscribe(() => refreshPackages());
    return unsub;
  }, [refreshPackages]);

  // Sync selectedPkg when packages update
  useEffect(() => {
    if (selectedPkg) {
      const fresh = packages.find((p) => p.id === selectedPkg.id) ?? null;
      setSelectedPkg(fresh);
    }
  }, [packages, selectedPkg?.id]);

  const handleCreate = () => {
    if (!createOwnerName.trim()) return;
    const pkg = createHandoverPackage({
      projectId: createProjectId,
      ownerName: createOwnerName,
      completedAt: new Date(createCompletedAt).toISOString(),
    });
    setSelectedPkg(pkg);
    setView("detail");
    setCheckedDocIds(new Set());
    setDocPreview(null);
  };

  const handleCollectDocuments = () => {
    if (!selectedPkg) return;
    const equipmentList = [
      ...Array.from(selectedEquipment).map((name) => ({ name })),
      ...(customEquipment.trim()
        ? customEquipment.split(",").map((s) => ({ name: s.trim() })).filter((e) => e.name)
        : []),
    ];
    const updated = collectDocuments(selectedPkg.id, equipmentList);
    if (updated) {
      setSelectedPkg(updated);
      // Also schedule milestones
      scheduleMaintenanceMilestones(selectedPkg.id);
    }
  };

  const toggleEquipment = (name: string) => {
    setSelectedEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleDocCheck = (docId: string) => {
    setCheckedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const handlePreviewDoc = () => {
    if (!selectedPkg) return;
    const doc = generateHandoverDocument(selectedPkg.id, "markdown");
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

  const handleMarkReview = () => {
    if (!selectedPkg) return;
    const updated = markReview(selectedPkg.id);
    if (updated) setSelectedPkg(updated);
  };

  const handleMarkDelivered = () => {
    if (!selectedPkg) return;
    const updated = markDelivered(selectedPkg.id);
    if (updated) setSelectedPkg(updated);
  };

  const handleArchive = () => {
    if (!selectedPkg) return;
    const updated = archivePackage(selectedPkg.id);
    if (updated) setSelectedPkg(updated);
  };

  const checklist = selectedPkg
    ? buildDocumentChecklist(selectedPkg.documents, checkedDocIds)
    : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">引渡しパッケージ</h1>
            <p className="text-xs text-slate-400 mt-0.5">Sprint 17-C — 書類自動収集・メンテナンス管理</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setView("create");
              setSelectedPkg(null);
              setDocPreview(null);
              setSelectedEquipment(new Set());
              setCustomEquipment("");
            }}
            className="text-sm font-medium px-4 py-2 rounded-lg text-white"
            style={{ background: SAGE }}
          >
            + 新規パッケージ
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="引渡し未完了" value={metricsPending} sub="件" />
          <KpiCard label="平均準備日数" value={metricsAvgDays} sub="日" />
          <KpiCard label="保証期限30日以内" value={metricsExpiring} sub="件" warn={metricsExpiring > 0} />
          <KpiCard
            label="最多書類種別"
            value={metricsTopKind ? DOCUMENT_KIND_LABELS[metricsTopKind] : "—"}
          />
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2 border-b border-slate-200">
          {(["list", "create"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                if (v === "list") { setSelectedPkg(null); setDocPreview(null); }
              }}
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
                <h2 className="text-sm font-bold text-slate-700">パッケージ情報を入力</h2>
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
                    <label className="text-xs text-slate-500 mb-1 block">施主名</label>
                    <input
                      type="text"
                      value={createOwnerName}
                      onChange={(e) => setCreateOwnerName(e.target.value)}
                      placeholder="例: 田中太郎"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                      style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">工事完成日</label>
                    <input
                      type="date"
                      value={createCompletedAt}
                      onChange={(e) => setCreateCompletedAt(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                      style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!createOwnerName.trim()}
                  className="w-full text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-40"
                  style={{ background: SAGE }}
                >
                  パッケージを作成
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="px-5 py-3 border-b border-slate-50">
                  <h2 className="text-sm font-bold text-slate-700">引渡しパッケージ一覧</h2>
                </div>
                {packages.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-400">
                    パッケージはまだありません
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {packages.map((pkg) => (
                      <PackageRow
                        key={pkg.id}
                        pkg={pkg}
                        onSelect={(p) => {
                          setSelectedPkg(p);
                          setView("detail");
                          setDocPreview(null);
                          setCheckedDocIds(new Set());
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: detail */}
          {selectedPkg && (
            <div className="space-y-4">
              {/* Main card */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">{selectedPkg.projectId}</div>
                    <h3 className="text-base font-bold text-slate-800">{selectedPkg.ownerName} 様</h3>
                    <div className="text-xs text-slate-500 mt-0.5">
                      完成: {formatDateJa(selectedPkg.completedAt)}
                    </div>
                  </div>
                  <StatusBadge status={selectedPkg.status} />
                </div>

                {/* Status actions */}
                <div className="flex flex-wrap gap-2">
                  {selectedPkg.status === "documents_collected" && (
                    <button
                      type="button"
                      onClick={handleMarkReview}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
                      style={{ background: "#d97706" }}
                    >
                      確認中へ
                    </button>
                  )}
                  {selectedPkg.status === "review" && (
                    <button
                      type="button"
                      onClick={handleMarkDelivered}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
                      style={{ background: SAGE }}
                    >
                      引渡し完了
                    </button>
                  )}
                  {selectedPkg.status === "delivered" && (
                    <button
                      type="button"
                      onClick={handleArchive}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      アーカイブ
                    </button>
                  )}
                </div>
              </div>

              {/* Equipment auto-collection (shown when draft) */}
              {selectedPkg.status === "draft" && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
                  <h4 className="text-sm font-bold text-slate-700">設備を選択して自動収集</h4>
                  <div className="flex flex-wrap gap-2">
                    {EQUIPMENT_PRESETS.map((eq) => {
                      const selected = selectedEquipment.has(eq);
                      return (
                        <button
                          key={eq}
                          type="button"
                          onClick={() => toggleEquipment(eq)}
                          className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                          style={{
                            background: selected ? `${SAGE}18` : "transparent",
                            borderColor: selected ? SAGE : "#e2e8f0",
                            color: selected ? SAGE : "#64748b",
                          }}
                        >
                          {eq}
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">その他の設備 (カンマ区切り)</label>
                    <input
                      type="text"
                      value={customEquipment}
                      onChange={(e) => setCustomEquipment(e.target.value)}
                      placeholder="例: 電動シャッター, 蓄電池"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                      style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCollectDocuments}
                    className="w-full text-sm font-medium px-4 py-2 rounded-lg text-white"
                    style={{ background: SAGE }}
                  >
                    書類を自動収集
                  </button>
                </div>
              )}

              {/* Document checklist */}
              {selectedPkg.documents.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <h4 className="text-sm font-bold text-slate-700 mb-3">
                    書類チェックリスト ({checkedDocIds.size}/{selectedPkg.documents.length})
                  </h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {checklist.map(({ doc, checked }) => {
                      const isExpiringSoon =
                        doc.expiresAt &&
                        new Date(doc.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
                        new Date(doc.expiresAt) > new Date();

                      return (
                        <div
                          key={doc.id}
                          className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDocCheck(doc.id)}
                            className="mt-0.5 rounded"
                            style={{ accentColor: SAGE }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${SAGE}18`, color: SAGE }}>
                                {DOCUMENT_KIND_LABELS[doc.kind]}
                              </span>
                              {isExpiringSoon && (
                                <span className="text-xs font-bold" style={{ color: DANGER }}>
                                  ⚠ 期限間近
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-700 mt-0.5 truncate">{doc.titleJa}</div>
                            {doc.expiresAt && (
                              <div className="text-xs text-slate-400 mt-0.5">
                                保証: {formatDateJa(doc.expiresAt)} まで
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Maintenance schedule preview */}
              {selectedPkg.maintenanceSchedule.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <h4 className="text-sm font-bold text-slate-700 mb-3">
                    メンテナンススケジュール
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedPkg.maintenanceSchedule.map((m) => {
                      const isPast = new Date(m.scheduledAt) <= new Date();
                      return (
                        <div
                          key={m.intervalMonths}
                          className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0"
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{
                              background: isPast ? "#f1f5f9" : `${SAGE}18`,
                              color: isPast ? "#94a3b8" : SAGE,
                            }}
                          >
                            {m.intervalMonths}M
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-slate-600 truncate">{m.descriptionJa}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {formatDateJa(m.scheduledAt)}
                              {isPast && <span className="ml-1 text-slate-300">（済）</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Package preview + export */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-700">パッケージプレビュー</h4>
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
