import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project, ProjectStatus } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { geocodeAddress } from "../infra/geocode.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const statusLabel: Record<ProjectStatus, string> = {
  planning: "計画中",
  active: "進行中",
  completed: "完了",
  on_hold: "保留",
};

const statusColor: Record<ProjectStatus, string> = {
  planning: "bg-blue-100 text-blue-700 border-blue-200",
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  completed: "bg-slate-100 text-slate-600 border-slate-200",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
};

const statusDot: Record<ProjectStatus, string> = {
  planning: "bg-blue-500",
  active: "bg-emerald-500",
  completed: "bg-slate-400",
  on_hold: "bg-amber-500",
};

export function ProjectListPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(
    () => createProjectRepository(() => organizationId),
    [organizationId],
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setProjects(await projectRepository.findAll());
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const validateName = (value: string): boolean => {
    if (!value.trim()) {
      setNameError("プロジェクト名を入力してください");
      return false;
    }
    if (value.trim().length < 2) {
      setNameError("プロジェクト名は2文字以上で入力してください");
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateName(name)) return;
    setSubmitting(true);

    try {
      const now = new Date();
      const trimmedAddress = address.trim();

      let latitude: number | undefined;
      let longitude: number | undefined;
      if (trimmedAddress) {
        const geo = await geocodeAddress(trimmedAddress);
        if (geo) {
          latitude = geo.lat;
          longitude = geo.lon;
        }
      }

      const project: Project = {
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description.trim(),
        status,
        startDate: startDate || toLocalDateString(now),
        includeWeekends: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        ...(trimmedAddress ? { address: trimmedAddress } : {}),
        ...(latitude !== undefined ? { latitude, longitude } : {}),
      };

      await projectRepository.create(project);
      setName("");
      setDescription("");
      setAddress("");
      setStatus("planning");
      setStartDate("");
      setShowForm(false);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount = projects.filter((p) => p.status === "active").length;
  const planningCount = projects.filter((p) => p.status === "planning").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">プロジェクト</h2>
          {projects.length > 0 && (
            <p className="mt-1 text-sm text-slate-500">
              {activeCount > 0 && <span className="text-emerald-600 font-medium">{activeCount}件 進行中</span>}
              {activeCount > 0 && planningCount > 0 && " / "}
              {planningCount > 0 && <span className="text-blue-600 font-medium">{planningCount}件 計画中</span>}
              {activeCount === 0 && planningCount === 0 && `${projects.length}件`}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors"
        >
          <span className="text-lg leading-none">{showForm ? "−" : "+"}</span>
          {showForm ? "フォームを閉じる" : "新規プロジェクト"}
        </button>
      </div>

      {/* New Project Form (Collapsible) */}
      {showForm && (
        <section className="rounded-xl border border-brand-200 bg-white p-5 sm:p-6 shadow-sm animate-in">
          <h3 className="mb-5 text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-600 text-xs">+</span>
            新規プロジェクト作成
          </h3>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <span className="shrink-0 mt-0.5">!</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="project-name" className="block text-sm font-medium text-slate-700">
                プロジェクト名 <span className="text-red-500">*</span>
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) validateName(e.target.value);
                }}
                onBlur={() => { if (name) validateName(name); }}
                required
                maxLength={200}
                autoComplete="off"
                className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-colors focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none ${
                  nameError ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
                }`}
                placeholder="例: 渋谷オフィスビル内装工事"
              />
              {nameError && (
                <p className="mt-1.5 text-xs text-red-600">{nameError}</p>
              )}
            </div>
            <div>
              <label htmlFor="project-description" className="block text-sm font-medium text-slate-700">
                説明
              </label>
              <input
                id="project-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                autoComplete="off"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                placeholder="工事概要やメモを入力"
              />
            </div>
            <div>
              <label htmlFor="project-address" className="block text-sm font-medium text-slate-700">
                現場住所
              </label>
              <input
                id="project-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={300}
                autoComplete="street-address"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                placeholder="例: 東京都港区南青山3-1-1"
              />
              <p className="mt-1 text-xs text-slate-400">天気予報の取得に使用されます</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="project-status" className="block text-sm font-medium text-slate-700">
                  ステータス
                </label>
                <select
                  id="project-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                >
                  <option value="planning">計画中</option>
                  <option value="active">進行中</option>
                  <option value="completed">完了</option>
                  <option value="on_hold">保留</option>
                </select>
              </div>
              <div>
                <label htmlFor="project-start-date" className="block text-sm font-medium text-slate-700">
                  開始日
                </label>
                <input
                  id="project-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className={`inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors ${
                  submitting ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {submitting ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    作成中...
                  </>
                ) : (
                  "作成"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Project List */}
      <section>
        {projects.length === 0 ? (
          <EmptyState onCreateClick={() => setShowForm(true)} />
        ) : (
          <>
            {/* Desktop table - hidden on mobile */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">プロジェクト名</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">現場</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">ステータス</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">開始日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projects.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-brand-50/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/project/${p.id}`)}
                      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/project/${p.id}`); }}
                      tabIndex={0}
                      role="link"
                      aria-label={`${p.name} - ${statusLabel[p.status]}`}
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        {p.description && (
                          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{p.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">{p.address ?? "-"}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusColor[p.status]}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDot[p.status]}`} />
                          {statusLabel[p.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 tabular-nums">{p.startDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="space-y-3 sm:hidden">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ── Empty State ─────────────────────────────────────── */

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-8 sm:p-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
        <svg width="32" height="32" viewBox="0 0 100 100" aria-hidden="true">
          <rect x="10" y="60" width="80" height="35" rx="3" fill="#1e3a5f" opacity="0.3" />
          <rect x="20" y="30" width="60" height="35" rx="3" fill="#2563eb" opacity="0.3" />
          <polygon points="50,5 15,35 85,35" fill="#f59e0b" opacity="0.5" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-slate-900">
        最初のプロジェクトを作成しましょう
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 leading-relaxed">
        プロジェクトを作成すると、工程管理・タスク追跡・現場天気の確認ができるようになります。まずは進行中の工事を1つ登録してみましょう。
      </p>
      <button
        onClick={onCreateClick}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors"
      >
        <span className="text-lg leading-none">+</span>
        プロジェクトを作成
      </button>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 text-left">
        <FeatureHint
          title="工程管理"
          description="ガントチャートでスケジュールを可視化"
        />
        <FeatureHint
          title="天気連動"
          description="現場の天気予報を自動取得"
        />
        <FeatureHint
          title="今日のタスク"
          description="現場で使えるモバイルダッシュボード"
        />
      </div>
    </div>
  );
}

function FeatureHint({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>
    </div>
  );
}

/* ── Mobile Project Card ─────────────────────────────── */

function ProjectCard({ project }: { project: Project }) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
      onClick={() => navigate(`/project/${project.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{project.description}</p>
          )}
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor[project.status]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot[project.status]}`} />
          {statusLabel[project.status]}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        {project.address && (
          <span className="flex items-center gap-1 truncate">
            <span aria-hidden="true">📍</span>
            {project.address}
          </span>
        )}
        <span className="flex items-center gap-1 tabular-nums">
          <span aria-hidden="true">📅</span>
          {project.startDate}
        </span>
      </div>
    </div>
  );
}
