import { useCallback, useEffect, useState } from "react";
import type { Expense, Project, Task } from "../domain/types.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { navigate } from "../hooks/useHashRouter.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import {
  buildDailyReportHtml,
  buildWeeklyReportHtml,
  buildProjectReportHtml,
  htmlToBlob,
} from "../lib/report-generator.js";

type ReportType = "daily" | "weekly" | "project";

const REPORT_LABELS: Record<ReportType, string> = {
  daily: "日報",
  weekly: "週報",
  project: "プロジェクト報告書",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function ReportsPage({ projectId }: { projectId?: string }) {
  const { getOrganizationId } = useOrganizationContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId ?? "");
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [date, setDate] = useState<string>(today());
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects
  useEffect(() => {
    const repo = createProjectRepository(getOrganizationId);
    repo.findAll().then((all) => {
      setProjects(all);
      if (!selectedProjectId && all.length > 0) {
        setSelectedProjectId(all[0].id);
      }
    }).catch(() => setError("案件の読み込みに失敗しました"));
  }, [getOrganizationId, selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const buildHtml = useCallback(async (): Promise<string> => {
    if (!selectedProject) return "";

    const taskRepo = createTaskRepository(getOrganizationId);
    const allTasks = await taskRepo.findAll();
    const tasks = allTasks.filter((t) => t.projectId === selectedProjectId) as Task[];
    const expenses: Expense[] = [];

    if (reportType === "daily") {
      return buildDailyReportHtml({ project: selectedProject, date, tasks });
    }
    if (reportType === "weekly") {
      return buildWeeklyReportHtml({ project: selectedProject, startDate: mondayOf(date), tasks, expenses });
    }
    return buildProjectReportHtml({ project: selectedProject, tasks, expenses });
  }, [selectedProject, selectedProjectId, reportType, date, getOrganizationId]);

  const handlePreview = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      const html = await buildHtml();
      setPreviewHtml(html);
    } catch (err) {
      setError(err instanceof Error ? err.message : "プレビュー生成に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [buildHtml, selectedProject]);

  const handleDownload = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      const html = await buildHtml();
      const blob = await htmlToBlob(html);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename = reportType === "daily"
        ? `日報_${selectedProject.name}_${date}.pdf`
        : reportType === "weekly"
          ? `週報_${selectedProject.name}_${mondayOf(date)}.pdf`
          : `報告書_${selectedProject.name}.pdf`;
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF生成に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [buildHtml, selectedProject, reportType, date]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">報告書</h1>
          <p className="text-sm text-slate-500">日報・週報・プロジェクト報告書を生成</p>
        </div>
        <button
          onClick={() => navigate("/app")}
          className="text-sm text-slate-500 hover:text-slate-700"
          type="button"
        >
          ← 戻る
        </button>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        {/* Project select */}
        <div>
          <label htmlFor="report-project" className="block text-sm font-medium text-slate-700 mb-1">
            案件
          </label>
          <select
            id="report-project"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {projects.length === 0 && <option value="">案件なし</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Report type */}
        <div>
          <span className="block text-sm font-medium text-slate-700 mb-1">種別</span>
          <div className="flex gap-2 flex-wrap">
            {(["daily", "weekly", "project"] as ReportType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setReportType(type)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  reportType === type
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {REPORT_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Date picker (hidden for project report) */}
        {reportType !== "project" && (
          <div>
            <label htmlFor="report-date" className="block text-sm font-medium text-slate-700 mb-1">
              {reportType === "weekly" ? "週内の日付（自動的に月曜起算）" : "日付"}
            </label>
            <input
              id="report-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {reportType === "weekly" && (
              <p className="mt-1 text-xs text-slate-400">
                対象週: {mondayOf(date)} 〜
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handlePreview}
            disabled={loading || !selectedProjectId}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {loading ? "生成中…" : "プレビュー"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || !selectedProjectId}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "生成中…" : "PDFダウンロード"}
          </button>
        </div>
      </div>

      {/* Preview */}
      {previewHtml && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700">プレビュー</span>
            <button
              type="button"
              onClick={() => setPreviewHtml("")}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              閉じる
            </button>
          </div>
          <iframe
            srcDoc={previewHtml}
            title="報告書プレビュー"
            className="w-full"
            style={{ height: "70vh", border: "none" }}
          />
        </div>
      )}
    </div>
  );
}
