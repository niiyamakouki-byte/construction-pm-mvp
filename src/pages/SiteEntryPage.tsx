import { useEffect, useRef, useState } from "react";
import {
  calculateManDays,
  getEntriesByCompany,
  getEntryLog,
  getTodayWorkerCount,
  logEntry,
  logExit,
} from "../lib/site-entry-log.js";
import type { SiteEntryRecord } from "../lib/site-entry-log.js";
import { navigate } from "../hooks/useHashRouter.js";

const LS_RECENT_WORKERS = "genbahub_kiosk_recent_workers";
const LS_RECORD_PREFIX = "genbahub_site_entry_record_";

const JOB_TYPES = [
  "大工",
  "電気",
  "設備",
  "内装",
  "解体",
  "左官",
  "塗装",
  "防水",
  "建具",
  "空調",
  "その他",
] as const;

type JobType = (typeof JOB_TYPES)[number];

type RecentWorker = {
  workerName: string;
  company: string;
  jobType: JobType;
  lastSeen: string;
};

function getRecentWorkers(): RecentWorker[] {
  try {
    const raw = localStorage.getItem(LS_RECENT_WORKERS);
    return raw ? (JSON.parse(raw) as RecentWorker[]) : [];
  } catch {
    return [];
  }
}

function saveRecentWorker(worker: RecentWorker): void {
  try {
    const existing = getRecentWorkers().filter(
      (w) => w.workerName !== worker.workerName || w.company !== worker.company,
    );
    const updated = [worker, ...existing].slice(0, 30);
    localStorage.setItem(LS_RECENT_WORKERS, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function getStoredRecord(projectId: string): SiteEntryRecord | null {
  try {
    const raw = localStorage.getItem(`${LS_RECORD_PREFIX}${projectId}`);
    return raw ? (JSON.parse(raw) as SiteEntryRecord) : null;
  } catch {
    return null;
  }
}

function storeRecord(projectId: string, record: SiteEntryRecord | null): void {
  try {
    if (record) {
      localStorage.setItem(
        `${LS_RECORD_PREFIX}${projectId}`,
        JSON.stringify(record),
      );
    } else {
      localStorage.removeItem(`${LS_RECORD_PREFIX}${projectId}`);
    }
  } catch {
    // ignore
  }
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function SiteEntryPage({ projectId }: { projectId: string }) {
  const now = useNow();
  const [recentWorkers, setRecentWorkers] = useState<RecentWorker[]>(
    () => getRecentWorkers(),
  );
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [selectedWorker, setSelectedWorker] = useState<RecentWorker | null>(
    null,
  );
  const [currentRecord, setCurrentRecord] = useState<SiteEntryRecord | null>(
    () => getStoredRecord(projectId),
  );
  const [todayLog, setTodayLog] = useState<SiteEntryRecord[]>([]);
  const [workerCount, setWorkerCount] = useState(0);
  const [flash, setFlash] = useState<{
    type: "in" | "out";
    name: string;
  } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual entry form
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [manualJob, setManualJob] = useState<JobType>("大工");

  const refreshLog = () => {
    const today = new Date().toISOString().slice(0, 10);
    setTodayLog(getEntryLog(projectId, today));
    setWorkerCount(getTodayWorkerCount(projectId));
  };

  useEffect(() => {
    refreshLog();
  }, [projectId, currentRecord]);

  const companies = Array.from(
    new Set(recentWorkers.map((w) => w.company).filter(Boolean)),
  );

  const filteredWorkers =
    companyFilter === "all"
      ? recentWorkers
      : recentWorkers.filter((w) => w.company === companyFilter);

  const showFlash = (type: "in" | "out", name: string) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash({ type, name });
    flashTimer.current = setTimeout(() => setFlash(null), 2500);
  };

  const handleQuickIn = (worker: RecentWorker) => {
    const record = logEntry(projectId, worker.workerName, worker.company);
    storeRecord(projectId, record);
    setCurrentRecord(record);
    saveRecentWorker({ ...worker, lastSeen: new Date().toISOString() });
    setRecentWorkers(getRecentWorkers());
    setSelectedWorker(null);
    showFlash("in", worker.workerName);
    refreshLog();
  };

  const handleExit = () => {
    if (!currentRecord) return;
    const updated = logExit(currentRecord.id);
    if (updated) {
      storeRecord(projectId, null);
      const exitedRecord = currentRecord;
      setCurrentRecord(null);
      showFlash("out", exitedRecord.workerName);
      refreshLog();
    }
  };

  const handleManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    const worker: RecentWorker = {
      workerName: manualName.trim(),
      company: manualCompany.trim(),
      jobType: manualJob,
      lastSeen: new Date().toISOString(),
    };
    const record = logEntry(projectId, worker.workerName, worker.company);
    storeRecord(projectId, record);
    setCurrentRecord(record);
    saveRecentWorker(worker);
    setRecentWorkers(getRecentWorkers());
    setShowManual(false);
    setManualName("");
    setManualCompany("");
    showFlash("in", worker.workerName);
    refreshLog();
  };

  const isEntered = currentRecord !== null && !currentRecord.exitTime;

  return (
    <div className="flex flex-col sm:flex-row h-screen w-screen overflow-hidden bg-slate-100 select-none">
      {/* Flash overlay */}
      {flash && (
        <div
          className={`pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 ${
            flash.type === "in" ? "bg-emerald-500/90" : "bg-red-500/90"
          }`}
        >
          <span className="text-[80px] font-black text-white leading-none">
            {flash.type === "in" ? "IN" : "OUT"}
          </span>
          <span className="text-3xl font-bold text-white">{flash.name}</span>
          <span className="text-xl text-white/80">
            {flash.type === "in" ? "入場しました" : "退場しました。お疲れ様でした。"}
          </span>
        </div>
      )}

      {/* Manual entry modal */}
      {showManual && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60"
          onClick={() => setShowManual(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-slate-900 mb-6">手動入力</h2>
            <form onSubmit={handleManualEntry} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">
                  名前 *
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="田中 太郎"
                  required
                  maxLength={100}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">
                  会社名
                </label>
                <input
                  type="text"
                  value={manualCompany}
                  onChange={(e) => setManualCompany(e.target.value)}
                  placeholder="ABC建設"
                  maxLength={100}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">
                  工種
                </label>
                <select
                  value={manualJob}
                  onChange={(e) => setManualJob(e.target.value as JobType)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                >
                  {JOB_TYPES.map((jt) => (
                    <option key={jt} value={jt}>
                      {jt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-600 hover:bg-slate-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={!manualName.trim()}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-base font-bold text-white disabled:opacity-50 hover:bg-emerald-700"
                >
                  入場
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Left panel: worker list */}
      <div className="flex flex-col w-0 flex-1 bg-white border-r border-slate-200">
        {/* Search / filter bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <span className="text-sm font-bold text-slate-600 shrink-0">
            会社
          </span>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="all">全社</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-slate-400">
            {filteredWorkers.length}名
          </span>
        </div>

        {/* Worker list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredWorkers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 pt-12">
              <span className="text-5xl" aria-hidden="true">
                👷
              </span>
              <p className="text-sm">職人が登録されていません</p>
              <p className="text-xs">手動入力ボタンから追加してください</p>
            </div>
          ) : (
            filteredWorkers.map((worker) => {
              const isSelected =
                selectedWorker?.workerName === worker.workerName &&
                selectedWorker?.company === worker.company;
              return (
                <button
                  key={`${worker.workerName}-${worker.company}`}
                  type="button"
                  onClick={() =>
                    setSelectedWorker(isSelected ? null : worker)
                  }
                  className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-colors ${
                    isSelected
                      ? "border-brand-600 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-full w-10 h-10 flex items-center justify-center text-white font-bold text-base shrink-0"
                      style={{ background: "#1d4ed8" }}
                    >
                      {worker.workerName.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-base truncate">
                        {worker.workerName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {worker.company && (
                          <span className="text-xs text-slate-500 truncate">
                            {worker.company}
                          </span>
                        )}
                        <span className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium shrink-0">
                          {worker.jobType}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="ml-auto text-brand-600 text-lg shrink-0">
                        ✓
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Add manual */}
        <div className="p-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            + 手動入力
          </button>
        </div>
      </div>

      {/* Right panel: IN/OUT + clock */}
      <div className="flex flex-col items-center justify-between w-full sm:w-72 sm:shrink-0 bg-slate-800 p-6">
        {/* Clock */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="text-xs text-slate-400 hover:text-white mb-3 inline-block"
          >
            &larr; GenbaHub
          </button>
          <div className="text-6xl font-black text-white tabular-nums leading-none">
            {pad2(now.getHours())}:{pad2(now.getMinutes())}
          </div>
          <div className="text-slate-400 text-sm mt-1 tabular-nums">
            {now.getFullYear()}/
            {pad2(now.getMonth() + 1)}/
            {pad2(now.getDate())}
          </div>
          <div className="mt-3 bg-slate-700 rounded-xl px-4 py-2 text-center">
            <p className="text-slate-400 text-xs">現在の入場者</p>
            <p className="text-3xl font-black text-white">
              {workerCount}
              <span className="text-base font-normal ml-1">名</span>
            </p>
          </div>
        </div>

        {/* Selected worker info */}
        <div className="w-full">
          {selectedWorker ? (
            <div className="bg-white/10 rounded-xl px-4 py-3 text-center mb-4">
              <p className="text-slate-400 text-xs mb-1">選択中</p>
              <p className="text-white font-bold text-xl">
                {selectedWorker.workerName}
              </p>
              {selectedWorker.company && (
                <p className="text-slate-400 text-sm mt-0.5">
                  {selectedWorker.company}
                </p>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center mb-4">
              左から職人を選択してください
            </p>
          )}

          {/* IN button */}
          <button
            type="button"
            disabled={!selectedWorker}
            onClick={() => selectedWorker && handleQuickIn(selectedWorker)}
            className="w-full rounded-2xl bg-emerald-500 disabled:bg-slate-600 disabled:opacity-40 py-6 font-black text-4xl text-white shadow-lg hover:bg-emerald-400 active:bg-emerald-600 transition-colors mb-4"
            style={{ minHeight: 100 }}
          >
            IN
          </button>

          {/* OUT button */}
          <button
            type="button"
            disabled={!isEntered}
            onClick={handleExit}
            className="w-full rounded-2xl bg-red-500 disabled:bg-slate-600 disabled:opacity-40 py-6 font-black text-4xl text-white shadow-lg hover:bg-red-400 active:bg-red-600 transition-colors"
            style={{ minHeight: 100 }}
          >
            OUT
          </button>

          {isEntered && currentRecord && (
            <p className="text-slate-400 text-xs text-center mt-2">
              {currentRecord.workerName} が入場中
            </p>
          )}
        </div>

        {/* History link */}
        <button
          type="button"
          onClick={() => navigate(`/attendance-history/${projectId}`)}
          className="text-slate-400 text-xs hover:text-white underline mt-2"
        >
          入退場履歴 &rarr;
        </button>
      </div>

      {/* Bottom: today log strip */}
      {todayLog.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 overflow-x-auto z-10 hidden lg:flex gap-2 px-4 py-2">
          {todayLog.map((rec) => (
            <div
              key={rec.id}
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs flex items-center gap-2"
            >
              <span className="font-semibold text-slate-800">
                {rec.workerName}
              </span>
              {rec.company && (
                <span className="text-slate-400">{rec.company}</span>
              )}
              <span className="text-slate-500 tabular-nums">
                {new Date(rec.entryTime).toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {rec.exitTime
                  ? ` → ${new Date(rec.exitTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`
                  : ""}
              </span>
              {!rec.exitTime && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  入場中
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
