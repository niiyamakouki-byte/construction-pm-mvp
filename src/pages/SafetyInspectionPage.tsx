import { useCallback, useMemo, useState } from "react";
import type { InspectionChecklist, ChecklistItem, ChecklistItemStatus } from "../lib/safety-inspection.js";
import { createDefaultChecklist, evaluateChecklist, generateInspectionReport } from "../lib/safety-inspection.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import type { KyActivity, NearMissReport } from "../lib/safety-records.js";
import { addKyActivity, addNearMissReport, listKyActivities, listNearMissReports } from "../lib/safety-records.js";

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

const SEVERITY_LABELS: Record<NearMissReport["severity"], string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const SEVERITY_STYLES: Record<NearMissReport["severity"], string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// ── Tab type ─────────────────────────────────────────────────────────────────

type Tab = "checklist" | "ky" | "nearmiss";

const TAB_DEFS: { key: Tab; label: string; icon: string }[] = [
  { key: "checklist", label: "チェックリスト", icon: "✅" },
  { key: "ky", label: "KY活動", icon: "⚠️" },
  { key: "nearmiss", label: "ヒヤリハット", icon: "🚨" },
];

// ── KY Activity Form ─────────────────────────────────────────────────────────

function KyActivityTab() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [participants, setParticipants] = useState("");
  const [hazards, setHazards] = useState("");
  const [countermeasures, setCountermeasures] = useState("");
  const [records, setRecords] = useState<KyActivity[]>(() => listKyActivities());
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const record = addKyActivity({
      date,
      participants: participants.split(/[,、\n]/).map((s) => s.trim()).filter(Boolean),
      hazards: hazards.split(/\n/).map((s) => s.trim()).filter(Boolean),
      countermeasures: countermeasures.split(/\n/).map((s) => s.trim()).filter(Boolean),
    });
    setRecords([record, ...listKyActivities().filter((r) => r.id !== record.id)]);
    setParticipants("");
    setHazards("");
    setCountermeasures("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-800">KY活動を記録</h2>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="ky-date">日付</label>
          <input
            id="ky-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="ky-participants">
            参加者（カンマ区切り）
          </label>
          <input
            id="ky-participants"
            type="text"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            placeholder="例: 山田太郎, 鈴木一郎"
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="ky-hazards">
            危険予知項目（1行1項目）
          </label>
          <textarea
            id="ky-hazards"
            rows={3}
            value={hazards}
            onChange={(e) => setHazards(e.target.value)}
            placeholder={"例:\n高所作業での墜落\n工具の落下"}
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="ky-countermeasures">
            対策（1行1項目）
          </label>
          <textarea
            id="ky-countermeasures"
            rows={3}
            value={countermeasures}
            onChange={(e) => setCountermeasures(e.target.value)}
            placeholder={"例:\nハーネス装着確認\nヘルメット着用"}
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
        >
          記録を保存
        </button>
        {saved && <p className="text-center text-xs text-emerald-600 font-semibold">保存しました</p>}
      </form>

      {records.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">過去の記録</h3>
          {records.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{r.date}</p>
                <p className="text-xs text-slate-500">{r.participants.join(" / ")}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">危険予知</p>
                <ul className="space-y-0.5">
                  {r.hazards.map((h, i) => (
                    <li key={i} className="text-xs text-slate-700 before:mr-1 before:content-['⚠']">{h}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">対策</p>
                <ul className="space-y-0.5">
                  {r.countermeasures.map((c, i) => (
                    <li key={i} className="text-xs text-slate-700 before:mr-1 before:content-['✓']">{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Near Miss Report Form ────────────────────────────────────────────────────

function NearMissTab() {
  const [datetime, setDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<NearMissReport["severity"]>("medium");
  const [causeAnalysis, setCauseAnalysis] = useState("");
  const [countermeasure, setCountermeasure] = useState("");
  const [reports, setReports] = useState<NearMissReport[]>(() => listNearMissReports());
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const record = addNearMissReport({ datetime, location, description, severity, causeAnalysis, countermeasure });
    setReports([record, ...listNearMissReports().filter((r) => r.id !== record.id)]);
    setLocation("");
    setDescription("");
    setCauseAnalysis("");
    setCountermeasure("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-800">ヒヤリハット報告</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="nm-datetime">日時</label>
            <input
              id="nm-datetime"
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="nm-severity">重要度</label>
            <select
              id="nm-severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as NearMissReport["severity"])}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="nm-location">場所</label>
          <input
            id="nm-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="例: 3階 東側廊下"
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="nm-description">内容</label>
          <textarea
            id="nm-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ヒヤリハットの状況を詳しく記述してください"
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="nm-cause">原因分析</label>
          <textarea
            id="nm-cause"
            rows={2}
            value={causeAnalysis}
            onChange={(e) => setCauseAnalysis(e.target.value)}
            placeholder="なぜ起きたか"
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="nm-countermeasure">対策</label>
          <textarea
            id="nm-countermeasure"
            rows={2}
            value={countermeasure}
            onChange={(e) => setCountermeasure(e.target.value)}
            placeholder="再発防止策"
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
        >
          報告を保存
        </button>
        {saved && <p className="text-center text-xs text-emerald-600 font-semibold">保存しました</p>}
      </form>

      {reports.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">報告履歴</h3>
          {reports.map((r) => (
            <div key={r.id} className={`rounded-xl border bg-white p-4 space-y-2 ${SEVERITY_STYLES[r.severity]}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{r.datetime.replace("T", " ")}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${SEVERITY_STYLES[r.severity]}`}>
                  重要度: {SEVERITY_LABELS[r.severity]}
                </span>
              </div>
              <p className="text-xs text-slate-600">場所: {r.location}</p>
              <p className="text-xs text-slate-800">{r.description}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">原因</p>
                  <p className="text-xs text-slate-700">{r.causeAnalysis}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">対策</p>
                  <p className="text-xs text-slate-700">{r.countermeasure}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SafetyInspectionPage() {
  const { organizationId } = useOrganizationContext();
  const [activeTab, setActiveTab] = useState<Tab>("checklist");
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

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">安全管理</h1>
        <p className="mt-1 text-sm text-slate-500">安全点検・KY活動・ヒヤリハット報告を管理します</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TAB_DEFS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              activeTab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span aria-hidden="true">{icon}</span> {label}
          </button>
        ))}
      </div>

      {/* Tab: Checklist */}
      {activeTab === "checklist" && (
        <>
          {!checklist ? (
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
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">安全点検</h2>
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

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-emerald-50 p-3 text-center border border-emerald-100">
                  <p className="text-lg font-bold tabular-nums text-emerald-700">{evaluation?.passCount ?? 0}</p>
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">合格</p>
                </div>
                <div className="rounded-xl bg-red-50 p-3 text-center border border-red-100">
                  <p className="text-lg font-bold tabular-nums text-red-700">{evaluation?.failCount ?? 0}</p>
                  <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">不合格</p>
                </div>
                {(() => {
                  const passRate = evaluation ? Math.round(evaluation.passRate * 100) : 0;
                  return (
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
                  );
                })()}
              </div>

              {(evaluation?.criticalFailures.length ?? 0) > 0 && (
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

              {Array.from(groupedItems.entries()).map(([category, items]) => (
                <section key={category}>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                    {getCategoryLabel(category)}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      {items.length}項目
                    </span>
                  </h3>
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
            </>
          )}
        </>
      )}

      {/* Tab: KY Activity */}
      {activeTab === "ky" && <KyActivityTab />}

      {/* Tab: Near Miss */}
      {activeTab === "nearmiss" && <NearMissTab />}
    </div>
  );
}
