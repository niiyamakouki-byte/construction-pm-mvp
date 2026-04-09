import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project, ProjectStatus } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { geocodeAddress } from "../infra/geocode.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { writeLastProjectId } from "../lib/last-project.js";

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

export function ProjectListPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [startDate, setStartDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const allProjects = await projectRepository.findAll();
    setProjects(allProjects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }, [projectRepository]);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validateName(name)) return;

    setSubmitting(true);
    try {
      const now = new Date();
      const trimmedAddress = address.trim();
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (trimmedAddress) {
        const geocode = await geocodeAddress(trimmedAddress);
        if (geocode) {
          latitude = geocode.lat;
          longitude = geocode.lon;
        }
      }

      await projectRepository.create({
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description.trim(),
        address: trimmedAddress || undefined,
        latitude,
        longitude,
        status,
        startDate: startDate || toLocalDateString(now),
        includeWeekends: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

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

  const openProjectGantt = (project: Project) => {
    writeLastProjectId(project.id);
    navigate(`/gantt/${project.id}`);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-[linear-gradient(145deg,#fffaf2_0%,#f6fbff_56%,#eff6ff_100%)] px-4 py-5 shadow-sm ring-1 ring-slate-200 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500">ホーム</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">案件一覧</h1>
            <p className="mt-2 text-sm text-slate-500">案件をタップすると、そのまま工程表を開きます。</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm"
          >
            {showForm ? "フォームを閉じる" : "新規プロジェクト"}
          </button>
        </div>
      </section>

      {showForm ? (
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">+</span>
            <h2 className="text-lg font-bold text-slate-900">新規プロジェクト作成</h2>
          </div>

          {error ? (
            <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="project-name" className="block text-sm font-medium text-slate-700">
                プロジェクト名 <span className="text-red-500">*</span>
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) validateName(event.target.value);
                }}
                onBlur={() => {
                  if (name) validateName(name);
                }}
                placeholder="例: 渋谷オフィスビル内装工事"
                className={`mt-1.5 w-full rounded-2xl border px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                  nameError ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
                }`}
              />
              {nameError ? <p className="mt-1.5 text-xs text-red-600">{nameError}</p> : null}
            </div>

            <div>
              <label htmlFor="project-description" className="block text-sm font-medium text-slate-700">
                説明
              </label>
              <input
                id="project-description"
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="工事概要やメモを入力"
                className="mt-1.5 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                onChange={(event) => setAddress(event.target.value)}
                placeholder="例: 東京都港区南青山3-1-1"
                className="mt-1.5 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="project-status" className="block text-sm font-medium text-slate-700">
                  ステータス
                </label>
                <select
                  id="project-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ProjectStatus)}
                  className="mt-1.5 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              >
                {submitting ? "作成中..." : "作成"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600"
              >
                キャンセル
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {projects.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">最初のプロジェクトを作成しましょう</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            プロジェクトを作成すると、工程表まで最短で移動できます。まずは1件登録してください。
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-6 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm"
          >
            プロジェクトを作成
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => openProjectGantt(project)}
              className="rounded-[26px] bg-white px-4 py-4 text-left shadow-sm ring-1 ring-slate-200 transition-transform active:scale-[0.99] sm:px-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{project.name}</h2>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusColor[project.status]}`}>
                      {statusLabel[project.status]}
                    </span>
                  </div>
                  {project.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">{project.description}</p>
                  ) : null}
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  工程表を開く
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span>{project.address ?? "住所未設定"}</span>
                <span>{project.startDate}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
