import { useEffect, useRef, useState } from "react";
import { SiteEntryRepository } from "../lib/supabase-adapter/SiteEntryRepository.js";
import type { SiteEntryRecord } from "../lib/supabase-adapter/SiteEntryRepository.js";
import { TaskRepository } from "../lib/supabase-adapter/TaskRepository.js";
import type { Task } from "../lib/supabase-adapter/TaskRepository.js";
import { PhotoRepository } from "../lib/supabase-adapter/PhotoRepository.js";
import type { PhotoRecord } from "../lib/supabase-adapter/PhotoRepository.js";
import { createDocumentRepository } from "../stores/document-store.js";
import type { ProjectDocument } from "../domain/types.js";
import { navigate } from "../hooks/useHashRouter.js";

const LS_RECENT_WORKERS = "genbahub_kiosk_recent_workers";
const siteEntryRepository = new SiteEntryRepository();
const taskRepository = new TaskRepository();
const photoRepository = new PhotoRepository();
const documentRepository = createDocumentRepository();

export const JOB_TYPES = [
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

export type JobType = (typeof JOB_TYPES)[number];

// ── Trade matching ─────────────────────────────────────────────────────────────
// Maps JobType keywords to task name/description patterns for filtering.
// ponytail: simple substring match, good enough for MVP task filtering
const JOB_TYPE_PATTERNS: Record<JobType, RegExp> = {
  大工: /大工|木工|造作/,
  電気: /電気|配線|電灯/,
  設備: /設備|給排水|空調|衛生/,
  内装: /内装|ボード|クロス|仕上/,
  解体: /解体|撤去/,
  左官: /左官|モルタル|タイル/,
  塗装: /塗装|ペイント/,
  防水: /防水/,
  建具: /建具|ドア|サッシ/,
  空調: /空調|エアコン|換気/,
  その他: /.*/,
};

export function filterTasksByJobType(tasks: Task[], jobType: JobType): Task[] {
  if (jobType === "その他") return tasks;
  const pattern = JOB_TYPE_PATTERNS[jobType];
  return tasks.filter(
    (t) => pattern.test(t.name) || pattern.test(t.description ?? ""),
  );
}

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

// ── Workflow steps ─────────────────────────────────────────────────────────────
type Step =
  | "idle"       // 職人選択 or 新規入力
  | "start-photo" // 開始写真撮影
  | "working"    // 入場中（タスク選択＋途中写真）
  | "end-photo"; // 完了写真撮影

export function SiteEntryPage({ projectId }: { projectId: string }) {
  const now = useNow();
  const [recentWorkers, setRecentWorkers] = useState<RecentWorker[]>(
    () => getRecentWorkers(),
  );
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [selectedWorker, setSelectedWorker] = useState<RecentWorker | null>(null);
  const [currentRecord, setCurrentRecord] = useState<SiteEntryRecord | null>(null);
  const [todayLog, setTodayLog] = useState<SiteEntryRecord[]>([]);
  const [workerCount, setWorkerCount] = useState(0);
  const [flash, setFlash] = useState<{ type: "in" | "out"; name: string } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual entry form
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [manualJob, setManualJob] = useState<JobType>("大工");

  // Workflow
  const [step, setStep] = useState<Step>("idle");
  const [pendingWorker, setPendingWorker] = useState<RecentWorker | null>(null);
  const [startPhotoFile, setStartPhotoFile] = useState<File | null>(null);
  const [endPhotoFile, setEndPhotoFile] = useState<File | null>(null);
  const [photoUploadFailed, setPhotoUploadFailed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Task selection
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Drawings (latest version only; documents table already holds only the current version)
  const [drawingDocuments, setDrawingDocuments] = useState<ProjectDocument[]>([]);
  const [showDocuments, setShowDocuments] = useState(false);

  // Progress photos (optional, in-flight files)
  const progressPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const refreshLog = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const records = await siteEntryRepository.listByProjectAsync(projectId, today);
    setTodayLog(records);
    setWorkerCount(records.filter((r) => !r.exitTime).length);
    setCurrentRecord((cur) => {
      if (cur && records.some((r) => r.id === cur.id && !r.exitTime)) return cur;
      return records.find((r) => !r.exitTime) ?? null;
    });
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const records = await siteEntryRepository.listByProjectAsync(projectId, today);
      if (cancelled) return;
      setTodayLog(records);
      setWorkerCount(records.filter((r) => !r.exitTime).length);
      setCurrentRecord(records.find((r) => !r.exitTime) ?? null);

      const tasks = await taskRepository.listByProjectAsync(projectId);
      if (cancelled) return;
      setProjectTasks(tasks);

      // Restore working step if an active record exists (e.g., page refresh)
      const active = records.find((r) => !r.exitTime);
      if (active) setStep("working");

      // Drawings: documents table already holds only the latest version per
      // document (old versions are moved to document_versions on update), so
      // no extra de-duplication is needed here.
      try {
        const allDocuments = await documentRepository.findAll();
        if (cancelled) return;
        setDrawingDocuments(
          allDocuments
            .filter((d) => d.projectId === projectId && d.type === "drawing")
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
      } catch {
        // 図面一覧が取得できなくても入退場フローは継続する（無言で失敗させない導線はUI側で対応）
        if (!cancelled) setDrawingDocuments([]);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [projectId]);

  // Re-filter tasks when worker job type changes
  useEffect(() => {
    if (pendingWorker) {
      setFilteredTasks(filterTasksByJobType(projectTasks, pendingWorker.jobType));
    } else if (currentRecord?.jobType) {
      const jt = currentRecord.jobType as JobType;
      setFilteredTasks(filterTasksByJobType(projectTasks, jt));
    }
  }, [projectTasks, pendingWorker, currentRecord]);

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

  // ── Upload helper: tries PhotoRepository, falls back gracefully ──────────────
  const tryUploadPhoto = async (
    file: File,
    category: string,
  ): Promise<string | null> => {
    try {
      const photo: PhotoRecord = {
        id: crypto.randomUUID(),
        projectId,
        fileName: file.name,
        category,
        url: URL.createObjectURL(file),
        takenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await photoRepository.saveAsync(photo);
      return photo.id;
    } catch {
      setPhotoUploadFailed(true);
      return null;
    }
  };

  // ── Step: worker selected → go to start-photo ─────────────────────────────
  const handleSelectWorker = (worker: RecentWorker) => {
    setPendingWorker(worker);
    setStartPhotoFile(null);
    setPhotoUploadFailed(false);
    setStep("start-photo");
  };

  // ── Step: start-photo captured → save entry record ────────────────────────
  const handleStartPhotoConfirm = async () => {
    if (!pendingWorker || !startPhotoFile) return;

    const photoId = await tryUploadPhoto(startPhotoFile, "start");
    const record: SiteEntryRecord = {
      id: crypto.randomUUID(),
      projectId,
      workerName: pendingWorker.workerName,
      company: pendingWorker.company,
      entryTime: new Date().toISOString(),
      jobType: pendingWorker.jobType,
      startPhotoId: photoId ?? undefined,
    };
    setSaveError(null);
    try {
      await siteEntryRepository.saveAsync(record);
    } catch {
      setSaveError("入場記録の保存に失敗しました。電波状況を確認してもう一度お試しください。");
      return;
    }
    setCurrentRecord(record);
    saveRecentWorker({ ...pendingWorker, lastSeen: new Date().toISOString() });
    setRecentWorkers(getRecentWorkers());
    setSelectedWorker(null);
    setPendingWorker(null);
    setStartPhotoFile(null);
    showFlash("in", record.workerName);
    setStep("working");
    await refreshLog();
  };

  // ── Progress photo: optional, any number ──────────────────────────────────
  const handleProgressPhoto = async (file: File) => {
    await tryUploadPhoto(file, "progress");
  };

  // ── Step: exit → go to end-photo ─────────────────────────────────────────
  const handleExitStart = () => {
    setEndPhotoFile(null);
    setPhotoUploadFailed(false);
    setStep("end-photo");
  };

  // ── Step: end-photo captured → save exit ─────────────────────────────────
  const handleEndPhotoConfirm = async () => {
    if (!currentRecord || !endPhotoFile) return;

    const photoId = await tryUploadPhoto(endPhotoFile, "end");
    const updated: SiteEntryRecord = {
      ...currentRecord,
      exitTime: new Date().toISOString(),
      endPhotoId: photoId ?? undefined,
      taskId: selectedTaskId ?? undefined,
    };
    setSaveError(null);
    try {
      await siteEntryRepository.saveAsync(updated);
    } catch {
      setSaveError("退場記録の保存に失敗しました。電波状況を確認してもう一度お試しください。");
      return;
    }
    showFlash("out", currentRecord.workerName);
    setCurrentRecord(null);
    setSelectedTaskId(null);
    setStep("idle");
    await refreshLog();
  };

  // ── Manual entry form ────────────────────────────────────────────────────
  const handleManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    const worker: RecentWorker = {
      workerName: manualName.trim(),
      company: manualCompany.trim(),
      jobType: manualJob,
      lastSeen: new Date().toISOString(),
    };
    setShowManual(false);
    setManualName("");
    setManualCompany("");
    handleSelectWorker(worker);
  };

  const isEntered = currentRecord !== null && !currentRecord.exitTime;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col sm:flex-row h-screen w-screen overflow-hidden bg-slate-100 select-none">
      <h1 className="sr-only">入退場管理</h1>

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

      {/* START PHOTO modal */}
      {step === "start-photo" && pendingWorker && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col gap-5">
            <h2 className="text-xl font-bold text-slate-900">開始写真を撮影</h2>
            <p className="text-sm text-slate-600">
              入場前に作業開始の状況を1枚撮影してください（必須）
            </p>
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-xl py-8 cursor-pointer hover:border-brand-400 transition-colors">
              {startPhotoFile ? (
                <span className="text-emerald-600 font-bold text-sm">
                  ✓ {startPhotoFile.name}
                </span>
              ) : (
                <>
                  <span className="text-4xl" aria-hidden="true">📷</span>
                  <span className="text-sm text-slate-500">タップしてカメラを起動</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setStartPhotoFile(f);
                }}
              />
            </label>
            {photoUploadFailed && (
              <p className="text-xs text-amber-600">
                写真のアップロードに失敗しました。レコードは保存されますが写真は未添付です。
              </p>
            )}
            {saveError && <p className="text-xs text-red-600 font-semibold">{saveError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep("idle"); setPendingWorker(null); setSaveError(null); }}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={!startPhotoFile}
                onClick={() => void handleStartPhotoConfirm()}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-base font-bold text-white disabled:opacity-50 hover:bg-emerald-700"
              >
                入場
              </button>
            </div>
          </div>
        </div>
      )}

      {/* END PHOTO modal */}
      {step === "end-photo" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col gap-5">
            <h2 className="text-xl font-bold text-slate-900">完了写真を撮影</h2>
            <p className="text-sm text-slate-600">
              退場前に作業完了の状況を1枚撮影してください（必須）
            </p>
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-xl py-8 cursor-pointer hover:border-brand-400 transition-colors">
              {endPhotoFile ? (
                <span className="text-emerald-600 font-bold text-sm">
                  ✓ {endPhotoFile.name}
                </span>
              ) : (
                <>
                  <span className="text-4xl" aria-hidden="true">📷</span>
                  <span className="text-sm text-slate-500">タップしてカメラを起動</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setEndPhotoFile(f);
                }}
              />
            </label>
            {photoUploadFailed && (
              <p className="text-xs text-amber-600">
                写真のアップロードに失敗しました。レコードは保存されますが写真は未添付です。
              </p>
            )}
            {saveError && <p className="text-xs text-red-600 font-semibold">{saveError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep("working"); setSaveError(null); }}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-600 hover:bg-slate-50"
              >
                戻る
              </button>
              <button
                type="button"
                disabled={!endPhotoFile}
                onClick={() => void handleEndPhotoConfirm()}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-base font-bold text-white disabled:opacity-50 hover:bg-red-700"
              >
                退場
              </button>
            </div>
          </div>
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
                <label className="text-xs font-semibold text-slate-600">名前 *</label>
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
                <label className="text-xs font-semibold text-slate-600">会社名</label>
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
                <label className="text-xs font-semibold text-slate-600">工種</label>
                <select
                  value={manualJob}
                  onChange={(e) => setManualJob(e.target.value as JobType)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                >
                  {JOB_TYPES.map((jt) => (
                    <option key={jt} value={jt}>{jt}</option>
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
                  次へ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawings modal (latest version only; hidden entirely when no drawings exist) */}
      {showDocuments && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60"
          onClick={() => setShowDocuments(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 max-h-[80vh] flex flex-col gap-4"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">図面・資料</h2>
              <button
                type="button"
                onClick={() => setShowDocuments(false)}
                aria-label="閉じる"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none shrink-0"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-slate-500">
              各図面の最新版のみ表示されます。旧版は資料ページの履歴から確認してください。
            </p>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2">
              {drawingDocuments.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border-2 border-slate-200 px-4 py-3 hover:border-brand-300 hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-800 text-sm truncate">
                    {doc.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                    {doc.version}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Left panel: worker list or working view */}
      <div className="flex flex-col w-full sm:w-0 sm:flex-1 min-h-0 flex-1 bg-white border-r border-slate-200">
        {isEntered && step === "working" ? (
          /* ── Working view: task list + progress photo ── */
          <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">🔨</span>
              <div>
                <p className="font-bold text-slate-900">{currentRecord?.workerName}</p>
                <p className="text-xs text-slate-500">{currentRecord?.jobType} · 作業中</p>
              </div>
            </div>

            {/* Task selection (optional) */}
            {filteredTasks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">担当工程を選択（任意）</p>
                <div className="flex flex-col gap-2">
                  {filteredTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setSelectedTaskId(selectedTaskId === t.id ? null : t.id)
                      }
                      className={`text-left rounded-xl border-2 px-4 py-3 transition-colors ${
                        selectedTaskId === t.id
                          ? "border-brand-600 bg-brand-50"
                          : "border-slate-200 bg-white hover:border-brand-300"
                      }`}
                    >
                      <p className="font-semibold text-slate-800 text-sm">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{t.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Progress photo */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">途中写真（任意・何枚でも）</p>
              <button
                type="button"
                onClick={() => progressPhotoInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-slate-300 py-4 text-sm font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                + 途中写真を追加
              </button>
              <input
                ref={progressPhotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleProgressPhoto(f);
                  // reset so same file can be re-selected
                  if (e.target) e.target.value = "";
                }}
              />
            </div>
          </div>
        ) : (
          /* ── Idle view: worker list ── */
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
              <span className="text-sm font-bold text-slate-600 shrink-0">会社</span>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="all">全社</option>
                {companies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="ml-auto text-xs text-slate-400">{filteredWorkers.length}名</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredWorkers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 pt-12">
                  <span className="text-5xl" aria-hidden="true">👷</span>
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
                      onClick={() => setSelectedWorker(isSelected ? null : worker)}
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
                              <span className="text-xs text-slate-500 truncate">{worker.company}</span>
                            )}
                            <span className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium shrink-0">
                              {worker.jobType}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="ml-auto text-brand-600 text-lg shrink-0">✓</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                + 手動入力
              </button>
            </div>
          </>
        )}
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

        {/* Selected worker info (idle state) */}
        <div className="w-full">
          {!isEntered && (
            <>
              {selectedWorker ? (
                <div className="bg-white/10 rounded-xl px-4 py-3 text-center mb-4">
                  <p className="text-slate-400 text-xs mb-1">選択中</p>
                  <p className="text-white font-bold text-xl">{selectedWorker.workerName}</p>
                  {selectedWorker.company && (
                    <p className="text-slate-400 text-sm mt-0.5">{selectedWorker.company}</p>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-sm text-center mb-4">
                  職人を選択してください
                </p>
              )}

              {/* IN button */}
              <button
                type="button"
                disabled={!selectedWorker}
                onClick={() => selectedWorker && handleSelectWorker(selectedWorker)}
                className="w-full rounded-2xl bg-emerald-500 disabled:bg-slate-600 disabled:opacity-40 py-6 font-black text-4xl text-white shadow-lg hover:bg-emerald-400 active:bg-emerald-600 transition-colors mb-4"
                style={{ minHeight: 100 }}
              >
                IN
              </button>

              {/* OUT disabled when not entered */}
              <button
                type="button"
                disabled
                className="w-full rounded-2xl bg-slate-600 opacity-40 py-6 font-black text-4xl text-white shadow-lg transition-colors"
                style={{ minHeight: 100 }}
              >
                OUT
              </button>
            </>
          )}

          {isEntered && (
            <>
              <div className="bg-white/10 rounded-xl px-4 py-3 text-center mb-4">
                <p className="text-slate-400 text-xs mb-1">入場中</p>
                <p className="text-white font-bold text-xl">{currentRecord?.workerName}</p>
                {currentRecord?.company && (
                  <p className="text-slate-400 text-sm mt-0.5">{currentRecord.company}</p>
                )}
              </div>

              {/* IN disabled when entered */}
              <button
                type="button"
                disabled
                className="w-full rounded-2xl bg-slate-600 opacity-40 py-6 font-black text-4xl text-white shadow-lg mb-4"
                style={{ minHeight: 100 }}
              >
                IN
              </button>

              {/* OUT button */}
              <button
                type="button"
                onClick={handleExitStart}
                className="w-full rounded-2xl bg-red-500 py-6 font-black text-4xl text-white shadow-lg hover:bg-red-400 active:bg-red-600 transition-colors"
                style={{ minHeight: 100 }}
              >
                OUT
              </button>
            </>
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

        {/* Drawings link (hidden when there are no drawings) */}
        {drawingDocuments.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDocuments(true)}
            className="text-slate-400 text-xs hover:text-white underline mt-2"
          >
            図面・資料を見る &rarr;
          </button>
        )}
      </div>

      {/* Bottom: today log strip */}
      {todayLog.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 overflow-x-auto z-10 hidden lg:flex gap-2 px-4 py-2">
          {todayLog.map((rec) => (
            <div
              key={rec.id}
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs flex items-center gap-2"
            >
              <span className="font-semibold text-slate-800">{rec.workerName}</span>
              {rec.company && <span className="text-slate-400">{rec.company}</span>}
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
