import { useEffect, useState } from "react";
import { logEntry, logExit, getEntryLog } from "../lib/site-entry-log.js";
import type { SiteEntryRecord } from "../lib/site-entry-log.js";
import { navigate } from "../hooks/useHashRouter.js";

const LS_WORKER_NAME = "genbahub_site_entry_worker_name";
const LS_COMPANY = "genbahub_site_entry_company";
const LS_RECORD_PREFIX = "genbahub_site_entry_record_";

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
      localStorage.setItem(`${LS_RECORD_PREFIX}${projectId}`, JSON.stringify(record));
    } else {
      localStorage.removeItem(`${LS_RECORD_PREFIX}${projectId}`);
    }
  } catch {
    // localStorage may be unavailable
  }
}

export function SiteEntryPage({ projectId }: { projectId: string }) {
  const [workerName, setWorkerName] = useState<string>(() => {
    try { return localStorage.getItem(LS_WORKER_NAME) ?? ""; } catch { return ""; }
  });
  const [company, setCompany] = useState<string>(() => {
    try { return localStorage.getItem(LS_COMPANY) ?? ""; } catch { return ""; }
  });
  const [currentRecord, setCurrentRecord] = useState<SiteEntryRecord | null>(() =>
    getStoredRecord(projectId),
  );
  const [todayLog, setTodayLog] = useState<SiteEntryRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setTodayLog(getEntryLog(projectId, today));
  }, [projectId, currentRecord]);

  const handleEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) return;
    setSubmitting(true);
    try {
      const record = logEntry(projectId, workerName, company);
      storeRecord(projectId, record);
      setCurrentRecord(record);
      try {
        localStorage.setItem(LS_WORKER_NAME, workerName.trim());
        localStorage.setItem(LS_COMPANY, company.trim());
      } catch {
        // ignore
      }
      setMessage("入場しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExit = () => {
    if (!currentRecord) return;
    setSubmitting(true);
    try {
      const updated = logExit(currentRecord.id);
      if (updated) {
        storeRecord(projectId, null);
        setCurrentRecord(null);
        setMessage("退場しました。お疲れ様でした。");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isEntered = currentRecord !== null && !currentRecord.exitTime;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start px-4 pt-8 pb-16">
      {/* Header */}
      <div className="w-full max-w-sm mb-6 text-center">
        <button
          onClick={() => navigate("/app")}
          className="text-xs text-slate-400 hover:text-brand-600 mb-4 inline-block"
        >
          &larr; GenbaHub
        </button>
        <div className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-1.5 rounded-full text-xs font-bold mb-3">
          <span aria-hidden="true">🏗</span>
          現場入退場
        </div>
        <h1 className="text-xl font-bold text-slate-900 leading-snug">
          {projectId}
        </h1>
      </div>

      {/* Success message */}
      {message && (
        <div className="w-full max-w-sm mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700 text-center">
          {message}
        </div>
      )}

      {/* Main card */}
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-md border border-slate-200 p-6">
        {isEntered ? (
          /* Already entered — show exit button */
          <div className="flex flex-col items-center gap-5">
            <div className="rounded-full bg-emerald-100 p-4">
              <span className="text-4xl" aria-hidden="true">✅</span>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">入場中</p>
              <p className="text-sm text-slate-500 mt-1">
                {currentRecord.workerName}
                {currentRecord.company ? ` / ${currentRecord.company}` : ""}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                入場: {new Date(currentRecord.entryTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={handleExit}
              className="w-full rounded-xl bg-red-500 px-6 py-4 text-lg font-bold text-white shadow-sm hover:bg-red-600 active:bg-red-700 disabled:opacity-50 transition-colors"
            >
              退場する
            </button>
          </div>
        ) : (
          /* Entry form */
          <form onSubmit={handleEntry} className="flex flex-col gap-4">
            <div className="text-center mb-2">
              <p className="text-base font-bold text-slate-800">入場登録</p>
              <p className="text-xs text-slate-500 mt-0.5">名前と会社名を入力して入場ボタンを押してください</p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600" htmlFor="worker-name">
                名前 *
              </label>
              <input
                id="worker-name"
                type="text"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                placeholder="田中 太郎"
                required
                maxLength={100}
                autoComplete="name"
                className="rounded-xl border border-slate-300 px-4 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600" htmlFor="company-name">
                会社名
              </label>
              <input
                id="company-name"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="ABC建設"
                maxLength={100}
                autoComplete="organization"
                className="rounded-xl border border-slate-300 px-4 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !workerName.trim()}
              className="mt-2 w-full rounded-xl bg-brand-600 px-6 py-4 text-lg font-bold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 transition-colors"
            >
              入場する
            </button>
          </form>
        )}
      </div>

      {/* Today's log */}
      {todayLog.length > 0 && (
        <div className="w-full max-w-sm mt-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            本日の入退場記録
          </h2>
          <ul className="space-y-2">
            {todayLog.map((record) => (
              <li
                key={record.id}
                className="rounded-xl bg-white border border-slate-200 px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{record.workerName}</p>
                  {record.company && (
                    <p className="text-xs text-slate-400">{record.company}</p>
                  )}
                </div>
                <div className="text-right text-xs text-slate-500 tabular-nums">
                  <p>
                    入:{" "}
                    {new Date(record.entryTime).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {record.exitTime && (
                    <p>
                      退:{" "}
                      {new Date(record.exitTime).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {!record.exitTime && (
                    <span className="inline-block mt-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      入場中
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
