import { useCallback, useMemo, useState } from "react";
import type { InspectionChecklist, ChecklistItem, ChecklistItemStatus } from "../lib/safety-inspection.js";
import { createDefaultChecklist, evaluateChecklist, generateInspectionReport } from "../lib/safety-inspection.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";

type ProjectType = "general" | "renovation" | "demolition" | "high-rise";

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  general: "一般建築",
  renovation: "リノベーション",
  demolition: "解体工事",
  "high-rise": "高層建築",
};

const STATUS_STYLES: Record<ChecklistItemStatus, { bg: string; label: string }> = {
  pass: { bg: "bg-emerald-50 border-emerald-200 text-emerald-700", label: "合格" },
  fail: { bg: "bg-red-50 border-red-200 text-red-700", label: "不合格" },
  na: { bg: "bg-slate-50 border-slate-200 text-slate-500", label: "N/A" },
};

const CATEGORY_LABELS: Record<string, string> = {
  ppe: "保護具",
  "fall-protection": "墜落防止",
  electrical: "電気安全",
  housekeeping: "整理整頓",
  "fire-safety": "防火",
  signage: "標識",
  hazmat: "有害物質",
  structural: "構造安全",
  excavation: "掘削",
  scaffolding: "足場",
  "crane-operations": "クレーン",
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function SafetyInspectionPage() {
  const { organizationId } = useOrganizationContext();
  const [projectType, setProjectType] = useState<ProjectType>("general");
  const [inspectorName, setInspectorName] = useState("");
  const [checklist, setChecklist] = useState<InspectionChecklist | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const handleStartInspection = useCallback(() => {
    const template = createDefaultChecklist(projectType);
    const today = new Date().toISOString().slice(0, 10);
    const newChecklist: InspectionChecklist = {
      id: `insp-${organizationId}-${Date.now()}`,
      projectId: organizationId ?? "",
      inspectedBy: inspectorName || "未記入",
      date: today,
      ...template,
    };
    setChecklist(newChecklist);
    setExportStatus(null);
  }, [inspectorName, organizationId, projectType]);

  const handleItemStatusChange = useCallback(
    (index: number, newStatus: ChecklistItemStatus) => {
      setChecklist((prev) => {
        if (!prev) return prev;
        const updatedItems = prev.items.map((item, i) =>
          i === index ? { ...item, status: newStatus } : item,
        );
        return { ...prev, items: updatedItems };
      });
    },
    [],
  );

  const handleItemNotesChange = useCallback(
    (index: number, notes: string) => {
      setChecklist((prev) => {
        if (!prev) return prev;
        const updatedItems = prev.items.map((item, i) =>
          i === index ? { ...item, notes } : item,
        );
        return { ...prev, items: updatedItems };
      });
    },
    [],
  );

  const evaluation = useMemo(
    () => (checklist ? evaluateChecklist(checklist) : null),
    [checklist],
  );

  const handleExportReport = useCallback(() => {
    if (!checklist) return;
    try {
      const html = generateInspectionReport(checklist);
      const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `安全点検_${checklist.date}.html`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportStatus("HTML報告書を出力しました");
    } catch (err) {
      setExportStatus(err instanceof Error ? err.message : "報告書出力に失敗しました");
    }
  }, [checklist]);

  // Group items by category for display
  const groupedItems = useMemo(() => {
    if (!checklist) return new Map<string, { item: ChecklistItem; index: number }[]>();
    const groups = new Map<string, { item: ChecklistItem; index: number }[]>();
    checklist.items.forEach((item, index) => {
      const list = groups.get(item.category) ?? [];
      list.push({ item, index });
      groups.set(item.category, list);
    });
    return groups;
  }, [checklist]);

  // ── No active inspection: show setup form ──
  if (!checklist) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 pb-8">
        <div>
          <h1 className="text-xl font-bold text-slate-900">安全点検</h1>
          <p className="mt-1 text-sm text-slate-500">
            現場の安全チェックリストを作成し、点検結果をHTML報告書として出力できます。
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <label htmlFor="project-type" className="block text-sm font-semibold text-slate-700 mb-1">
              工事種別
            </label>
            <select
              id="project-type"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {(Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map((type) => (
                <option key={type} value={type}>
                  {PROJECT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="inspector-name" className="block text-sm font-semibold text-slate-700 mb-1">
              点検者名
            </label>
            <input
              id="inspector-name"
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="例: 山田太郎"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <button
            type="button"
            onClick={handleStartInspection}
            className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
          >
            点検を開始
          </button>
        </div>
      </div>
    );
  }

  // ── Active inspection: show checklist ──
  const passRate = evaluation ? Math.round(evaluation.passRate * 100) : 0;
  const hasCritical = (evaluation?.criticalFailures.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">安全点検</h1>
          <p className="text-sm text-slate-500">
            {checklist.date} / {checklist.inspectedBy}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setChecklist(null)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          新規作成
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-emerald-50 p-3 text-center border border-emerald-100">
          <p className="text-lg font-bold tabular-nums text-emerald-700">{evaluation?.passCount ?? 0}</p>
          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">合格</p>
        </div>
        <div className="rounded-xl bg-red-50 p-3 text-center border border-red-100">
          <p className="text-lg font-bold tabular-nums text-red-700">{evaluation?.failCount ?? 0}</p>
          <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">不合格</p>
        </div>
        <div className={`rounded-xl p-3 text-center border ${
          passRate >= 90
            ? "bg-emerald-50 border-emerald-100"
            : passRate >= 70
              ? "bg-amber-50 border-amber-100"
              : "bg-red-50 border-red-100"
        }`}>
          <p className={`text-lg font-bold tabular-nums ${
            passRate >= 90 ? "text-emerald-700" : passRate >= 70 ? "text-amber-700" : "text-red-700"
          }`}>
            {passRate}%
          </p>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">合格率</p>
        </div>
      </div>

      {/* Critical failure warning */}
      {hasCritical && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-bold">重大な不合格項目があります</p>
          <ul className="mt-1 list-disc pl-4 text-xs">
            {evaluation!.criticalFailures.map((item, i) => (
              <li key={i}>
                {getCategoryLabel(item.category)}: {item.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Checklist items grouped by category */}
      {Array.from(groupedItems.entries()).map(([category, items]) => (
        <section key={category}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
            {getCategoryLabel(category)}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {items.length}項目
            </span>
          </h2>
          <ul className="space-y-2">
            {items.map(({ item, index }) => (
              <li
                key={index}
                className={`rounded-xl border p-3 ${STATUS_STYLES[item.status].bg}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 text-sm text-slate-800">{item.description}</p>
                  <div className="flex shrink-0 gap-1">
                    {(["pass", "fail", "na"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleItemStatusChange(index, status)}
                        className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-all ${
                          item.status === status
                            ? status === "pass"
                              ? "bg-emerald-600 text-white"
                              : status === "fail"
                                ? "bg-red-600 text-white"
                                : "bg-slate-500 text-white"
                            : "bg-white/80 text-slate-500 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {STATUS_STYLES[status].label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => handleItemNotesChange(index, e.target.value)}
                  placeholder="備考"
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Export button */}
      {exportStatus && (
        <p className="text-sm text-slate-500">{exportStatus}</p>
      )}
      <button
        type="button"
        onClick={handleExportReport}
        className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
      >
        HTML報告書を出力
      </button>
    </div>
  );
}
