import { useEffect, useState } from "react";
import {
  calculateManDays,
  exportToCSV,
  getEntriesByCompany,
  getEntryLog,
} from "../lib/site-entry-log.js";
import type { SiteEntryRecord } from "../lib/site-entry-log.js";
import { navigate } from "../hooks/useHashRouter.js";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatHours(entry: SiteEntryRecord): string {
  if (!entry.exitTime) return "-";
  const h =
    (new Date(entry.exitTime).getTime() - new Date(entry.entryTime).getTime()) /
    (1000 * 60 * 60);
  return `${h.toFixed(1)}h`;
}

function downloadCSV(content: string, filename: string): void {
  const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AttendanceHistoryPage({ projectId }: { projectId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [entries, setEntries] = useState<SiteEntryRecord[]>([]);
  const [byCompany, setByCompany] = useState<Map<string, SiteEntryRecord[]>>(
    new Map(),
  );

  useEffect(() => {
    const recs = getEntryLog(projectId, selectedDate);
    setEntries(recs);
    setByCompany(getEntriesByCompany(projectId, selectedDate));
  }, [projectId, selectedDate]);

  const totalWorkers = entries.length;
  const completedEntries = entries.filter((e) => e.exitTime);
  const totalManDays = calculateManDays(completedEntries);
  const onSiteCount = entries.filter((e) => !e.exitTime).length;

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().slice(0, 10);
    if (next <= today) setSelectedDate(next);
  };

  const handleExportCSV = () => {
    const csv = exportToCSV(entries);
    const filename = `入退場記録_${selectedDate}.csv`;
    downloadCSV(csv, filename);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`/entry/${projectId}`)}
          className="text-slate-400 hover:text-brand-600 text-sm font-medium"
        >
          &larr; キオスク
        </button>
        <h1 className="font-bold text-slate-900 text-base flex-1">
          入退場履歴
          {projectId && (
            <span className="ml-2 text-slate-400 text-sm font-normal">
              {projectId}
            </span>
          )}
        </h1>
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={entries.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 disabled:bg-slate-300 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          <span aria-hidden="true">⬇</span>
          CSV出力
        </button>
      </header>

      {/* Date picker bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-slate-100">
        <button
          type="button"
          onClick={handlePrevDay}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          &lt;
        </button>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <button
          type="button"
          onClick={handleNextDay}
          disabled={selectedDate >= today}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          &gt;
        </button>
        <button
          type="button"
          onClick={() => setSelectedDate(today)}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
        >
          今日
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 px-4 py-4">
        <div className="rounded-xl bg-white border border-slate-200 p-4 text-center shadow-sm">
          <p className="text-xs text-slate-500 mb-1">入場者数</p>
          <p className="text-3xl font-black text-slate-900">{totalWorkers}</p>
          <p className="text-xs text-slate-400 mt-0.5">名</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4 text-center shadow-sm">
          <p className="text-xs text-slate-500 mb-1">延べ人工</p>
          <p className="text-3xl font-black text-purple-700">
            {totalManDays.toFixed(2)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">人工</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4 text-center shadow-sm">
          <p className="text-xs text-slate-500 mb-1">現在入場中</p>
          <p className="text-3xl font-black text-emerald-600">{onSiteCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">名</p>
        </div>
      </div>

      {/* Records by company */}
      <div className="flex-1 px-4 pb-16 space-y-4">
        {byCompany.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <span className="text-5xl" aria-hidden="true">📋</span>
            <p className="text-sm">この日の入退場記録はありません</p>
          </div>
        ) : (
          Array.from(byCompany.entries()).map(([company, recs]) => {
            const companyManDays = calculateManDays(recs.filter((r) => r.exitTime));
            return (
              <div
                key={company}
                className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm"
              >
                {/* Company header */}
                <div className="flex items-center justify-between bg-brand-50 border-b border-brand-100 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-brand-700 font-bold text-sm">
                      🏢 {company}
                    </span>
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                      {recs.length}名
                    </span>
                  </div>
                  <span className="text-xs text-purple-700 font-bold">
                    {companyManDays.toFixed(2)} 人工
                  </span>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-5 px-4 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <span className="col-span-2">氏名</span>
                  <span className="text-center">IN</span>
                  <span className="text-center">OUT</span>
                  <span className="text-center">時間/人工</span>
                </div>

                {/* Rows */}
                {recs.map((rec) => {
                  const manDays = calculateManDays([rec]);
                  return (
                    <div
                      key={rec.id}
                      className="grid grid-cols-5 px-4 py-2.5 border-b border-slate-50 last:border-0 items-center"
                    >
                      <span className="col-span-2 font-semibold text-slate-900 text-sm truncate">
                        {rec.workerName}
                      </span>
                      <span className="text-center text-sm font-mono text-emerald-700">
                        {formatTime(rec.entryTime)}
                      </span>
                      <span className="text-center text-sm font-mono text-red-600">
                        {rec.exitTime ? formatTime(rec.exitTime) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            入場中
                          </span>
                        )}
                      </span>
                      <span className="text-center text-xs text-slate-600">
                        {formatHours(rec)}
                        {rec.exitTime && (
                          <span className="block text-purple-600 font-bold">
                            {manDays.toFixed(2)}人工
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
